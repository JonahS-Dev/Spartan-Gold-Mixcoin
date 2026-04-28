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
      this.checkWarranty(warranty);
    }
  }

  checkWarranty(warranty) {
    // let blockHashTemp = this.lastConfirmedBlock.hashVal(); //prevBlockHash; //.hashVal();


    // Check all warranties
    console.log(warranty);
    // Check to see if the payout was fulfilled in any block
    console.log(this.lastConfirmedBlock);
    let currBlock = this.blocks.get(this.lastConfirmedBlock.hashVal());
    while(currBlock !== undefined || currBlock.timestamp > warranty.clientDeadline)
    {
      console.log(currBlock.chainLength);
      if(currBlock.timestamp > warranty.mixerDeadline) {
        console.log(currBlock.chainLength);
        for(let tx of currBlock.transactions) {
          console.log(tx);
          if(tx.from === warranty.mixerAddress && tx.outputs.includes({amount: warranty.payoutAmount, address: warranty.outputAddress})) {
            console.log("PAYOUT FROM WARRANTY FOUND");
            return;
          }
        }
      }
      // console.log(`CONTAINS? ${currBlock.contains()}`)
      // blockHashTemp = currBlock.prevBlockHash;
      currBlock = this.blocks.get(currBlock.prevBlockHash);
      if(currBlock === undefined) break;
    }

    console.log("PAYOUT FROM WARRANTY NOT FOUND");
    // Maybe we want to broadcast the warranty?
  }
};
