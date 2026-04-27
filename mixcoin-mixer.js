"use strict";

const UtxoClient = require("./utxo-client.js");
const MixcoinConstants = require("./mixcoin-constants.js");
const { Blockchain, utils } = require('spartan-gold');

/**
 * A MixCoin mixer node.
 */
module.exports = class MixcoinMixer extends UtxoClient {
  constructor(...args) {
    super(...args);
    this.setupRequestListener();
    this.setupTransactionListener();
    this.seenRequests = new Set();
    this.warrantedRequests = new Map();
    this.fundedRequests = new Set();
  }

  reviewRequest(request) {
    console.log(`RECEIVED REQUEST ${request}`);

    // FIXME: Need to include the relevant information and sign here
    
    // Page 7: https://soc1024.ece.illinois.edu/mix.pdf
    // Chunk size: v
    // Input address: K_in
    // Output address: deadline t1 (by which Alice will send the funds. Alice does not have to send the funds)
    // Nonce: n
    // Additional parameters included by the mixer:
    // t2: time by which the mixer will return the funds to the address (public policy)
    // ρ: fee rate
    let {chunkSize, inputAddress, outputAddress, clientDeadline, nonce, returnAddr} = request;

    // Check for a request that the mixer wants to sign. 
    // Probably want to sign a fixed chunk size,
    // and check that the nonce has not been used
    if(chunkSize !== MixcoinConstants.STANDARD_CHUNK_SIZE) {
      return { status: MixcoinConstants.STATUS_REJECTED, msg: "Chunk size not standard. Please use standard chunk size." };
    }

    if(this.seenRequests.has(nonce)) {
      return { status: MixcoinConstants.STATUS_REJECTED, msg: "Request received before. Possible replay attack." };
    } else {
      this.seenRequests.add(nonce);
    }

    // Creates the mixer deadline 24 hours after the client deadline
    let mixerDeadline = new Date(clientDeadline);
    mixerDeadline.setHours(mixerDeadline.getHours() + 24);

    let acceptedRequest = {
      chunkSize: chunkSize, 
      inputAddress: inputAddress, 
      outputAddress: outputAddress,
      clientDeadline: clientDeadline,
      mixerDeadline: mixerDeadline,
      nonce: nonce,
      mixerAddress: this.address,
    };

    // store mixer state for warranted requests (mixer accepted and signed) so we can track funding and payout
    this.warrantedRequests.set(nonce, {
      chunkSize: acceptedRequest.chunkSize,
      inputAddress: acceptedRequest.inputAddress,
      outputAddress: acceptedRequest.outputAddress,
      clientDeadline: acceptedRequest.clientDeadline,
      mixerDeadline: acceptedRequest.mixerDeadline,
      nonce: acceptedRequest.nonce,
      mixerAddress: acceptedRequest.mixerAddress,
      funded: false, // tracks when the mixer sees the funding transaction
      mixed: false, // tracks when coins are paid out after mixing
    });

    let signature = utils.sign(this.keyPair.private, acceptedRequest);

    return { status: MixcoinConstants.STATUS_ACCEPTED, 
      warranty: acceptedRequest,
      signature: signature,
      msg: "Request accepted"
    };
  }

  /**
   * listen for incoming mix requests from clients, then
   * accept or reject it
   */
  setupRequestListener() {
    this.on(MixcoinConstants.REQUEST_MIX, (request) => {
      let response = this.reviewRequest(request);

      // send response back
      this.net.sendMessage(request.returnAddr, MixcoinConstants.REQUEST_MIX_RESPONSE, response);
    });
  }

  // allow mixer to listen for posted transactions
  setupTransactionListener() {
    this.on(Blockchain.POST_TRANSACTION, (tx) => {
      this.recordFundedRequests(tx);
    });
  }

  // check if a posted transaction is funding a mix request
  recordFundedRequests(tx) {
    for (let [nonce, request] of this.warrantedRequests.entries()) {
      // skip requests that were already funded or mixed
      if (request.funded || request.mixed) {
        continue;
      }

      // funding transaction must spend from the expected input address.
      if (!tx.from.includes(request.inputAddress)) {
        continue;
      }

      // funding transaction must pay the expected chunk to the mixer
      let hasExpectedMixerOutput = tx.outputs.some(({ amount, address }) => {
        // loop through all outputs and see if any of them send amount = chunkSize
        // with the to address = mixerAddress
        return amount === request.chunkSize && address === request.mixerAddress;
      });

      if (!hasExpectedMixerOutput) {
        continue;
      }

      // mark request as funded
      request.funded = true;
      this.warrantedRequests.set(nonce, request);

      // queue request for mixing
      this.fundedRequests.add(nonce);
      console.log(`Mixer recorded funded request ${nonce}`);

      // wait before attempting to payout
      setTimeout(() => {
        this.mixCoins(Array.from(this.fundedRequests));
      }, 1200);
    }
  }

  // collect coins, shuffle them, and send them back
  mixCoins(requestIds) {
    // only mix requests that are funded and not already paid out
    let readyRequests = [];
    for (let requestId of requestIds) {
      let request = this.warrantedRequests.get(requestId);
      if (request.funded && !request.mixed) {
        readyRequests.push(request);
      }
    }

    if (readyRequests.length === 0) {
      return null;
    }

    // collect output addresses for this mix round
    let payoutAddresses = [];
    for (let request of readyRequests) {
      payoutAddresses.push(request.outputAddress);
    }

    // shuffle payout order so it does not match funding order
    let shuffledAddresses = [];
    while (payoutAddresses.length > 0) {
      let index = Math.floor(Math.random() * payoutAddresses.length);
      let removedAddresses = payoutAddresses.splice(index, 1);
      let address = removedAddresses[0];
      shuffledAddresses.push(address);
    }

    // create outputs for each recipient
    let outputs = shuffledAddresses.map((address) => ({
      amount: MixcoinConstants.STANDARD_CHUNK_SIZE,
      address: address,
    }));

    // send payout transaction
    let tx = this.postTransaction(outputs, 0);

    // mark each request as mixed and remove it from funded queue
    for (let request of readyRequests) {
      request.mixed = true;
      this.warrantedRequests.set(request.nonce, request);
      this.fundedRequests.delete(request.nonce);
    }

    console.log(`Paid out ${readyRequests.length} mix request(s) in transaction ${tx.id}`);

    // return payout transaction
    return tx;
  }
};