"use strict";

const UtxoClient = require("./utxo-client.js");
const MixcoinConstants = require("./mixcoin-constants.js");
const { FakeNet, utils } = require('spartan-gold');
let crypto = require('crypto');

/**
 * Add Mixcoin client behavior on top of the UTXO client
 */
module.exports = class MixcoinClient extends UtxoClient {
  constructor(...args) {
    super(...args);

    // store submitted mixing requests
    this.pendingMixRequests = new Map();
    this.pendingMixRequestPubkeys = new Map();

    // store promises/warranties from mixers to use as evidence
    this.warranties = new Map();

    this.setupResponseListener();
  }

  setupResponseListener() {
    this.on(MixcoinConstants.REQUEST_MIX_RESPONSE, (response) => {
      console.log(`RECEIVED RESPONSE ${response}`);
      console.log(`Response Message ${response.msg}`);
      console.log(`Response Warranty ${response.warranty}`);
      if (response.status !== MixcoinConstants.STATUS_ACCEPTED) {
        return;
      }
      if (!this.hasValidFeeTerms(response.warranty)) {
        console.log("Rejected warranty, invalid fee terms");
        return;
      }
      let validWarranty = this.verifyWarranty(response.warranty, response.signature);
      if(validWarranty) {
        this.rememberWarranty(response.warranty, response.signature);
        console.log("added valid warranty");
        this.fundMixRequest(response.warranty.nonce);
      }
    });
  }

  // make sure mixer fee terms in the warranty make sense
  hasValidFeeTerms(warranty) {
    if (warranty.mixerFeeRate < 0 || warranty.mixerFeeRate > 100 || warranty.payoutAmount > warranty.chunkSize || warranty.payoutAmount < 0) {
      return false;
    }

    return true;
  }

  // remember sent mixing requests to see the outcome later
  rememberPendingMixRequest(request, mixerPubKey) {
    this.pendingMixRequests.set(request.nonce, request);
    this.pendingMixRequestPubkeys.set(request.nonce, mixerPubKey);
  }

  // store warranties from mixers to use as evidence in the future
  rememberWarranty(warranty, sig) {
    this.warranties.set(warranty.nonce, {warranty: warranty, signature: sig});
  }

  // verify that the warranty is valid before sending coins
  verifyWarranty(warranty, sig) {
    return utils.verifySignature(this.pendingMixRequestPubkeys.get(warranty.nonce), warranty, sig);
  }

  // after warranty is verified, send amount to mixer's deposit address
  fundMixRequest(nonce) {
    let request = this.pendingMixRequests.get(nonce);

    // only fund a request once
    if (request.funded === true) {
      return;
    }

    // send the mix amount to the mixer
    this.postTransaction([{ amount: request.chunkSize, address: request.mixerAddress }]);

    // remember that this request was funded
    request.funded = true;
    console.log(`Funded mix request ${nonce}`);
  }

  // send a mix request to a mixer
  requestMix(mixerAddress, chunkSize, inputAddr, outputAddr, deadlineT1, mixerPubKey) {
    // create request, sign it, then broadcast it similar to how
    // postTransaction works on utxo-mixin
    console.log("REQUSTING MIX");
    let nonce = crypto.randomBytes(16).toString('base64');
    
    let request = {
      chunkSize: chunkSize, 
      inputAddress: inputAddr, 
      outputAddress: outputAddr,
      clientDeadline: deadlineT1,
      nonce: nonce,
      returnAddr: this.address,
      mixerAddress: mixerAddress,
      funded: false,
    };

    this.rememberPendingMixRequest(request, mixerPubKey);
    this.net.sendMessage(mixerAddress, MixcoinConstants.REQUEST_MIX, request);
  }

  checkAllWarranties() {
    for(let [nonce, {warranty, signature}] of this.warranties) {
      this.checkWarranty(warranty, signature);
    }
  }

  checkWarranty(warranty, signature) {
    // go backward from the latest confirmed block
    let currBlock = this.lastConfirmedBlock;

    while (currBlock !== undefined && currBlock.timestamp > warranty.clientDeadline) {
      // only blocks before the mixer deadline can satisfy the warranty
      if (currBlock.timestamp <= warranty.mixerDeadline) {

        // loop through transactions in the current block
        for (let [txId, tx] of currBlock.transactions) {
          // check whether mixer funded this transaction
          let cameFromMixer = tx.from.includes(warranty.mixerAddress);

          // check whether any output pays the expected amount to the expected address
          let hasCorrectPayout = tx.outputs.some(({ amount, address }) => {
            let isAmountMatch = amount === warranty.payoutAmount;
            let isAddressMatch = address === warranty.outputAddress;

            return isAmountMatch && isAddressMatch;
          });

          let payoutFound = cameFromMixer && hasCorrectPayout;

          if (payoutFound) {
            console.log(`Warranty payout found! Transaction ID: ${txId}`);
            return txId;
          }
        }
      }

      currBlock = this.blocks.get(currBlock.prevBlockHash);
    }

    // if no valid payout exists, report the mixer as a cheater
    console.log("PAYOUT FROM WARRANTY NOT FOUND, BROADCASTING MIXER AS CHEATER.");
    this.net.broadcast(MixcoinConstants.CHEATER_FOUND, {
      warranty: warranty,
      signature: signature,
    });

    return false;
  }
};
