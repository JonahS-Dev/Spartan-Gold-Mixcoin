"use strict";

const UtxoClient = require("./utxo-client.js");
const MixcoinConstants = require("./mixcoin-constants.js");
const { FakeNet, utils } = require('spartan-gold');

/**
 * A MixCoin mixer node.
 */
module.exports = class MixcoinMixer extends UtxoClient {
  constructor(...args) {
    super(...args);
    this.setupRequestListener();
    this.seenRequests = new Set();
  }

  // accept all requests
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
    };

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

  // collect coins, shuffle them, and send them back
  mixCoins(requestIds) {
    
  }
};