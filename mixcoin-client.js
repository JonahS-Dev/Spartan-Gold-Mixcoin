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
      let validWarranty = this.verifyWarranty(response.warranty, response.signature);
      if(validWarranty) {
        this.rememberWarranty(response.warranty, response.signature);
        console.log("added valid warranty");
      }
    });
  }

  // remember sent mixing requests to see the outcome later
  rememberPendingMixRequest(request, mixerPubKey) {
    this.pendingMixRequests.set(request.nonce, request);
    this.pendingMixRequestPubkeys.set(request.nonce, mixerPubKey);
  }

  // store warranties from mixers to use as evidence in the future
  rememberWarranty(warranty, sig) {
    this.warranties.set(warranty.requestId, {warranty: warranty, signature: sig});
  }

  // verify that the warranty is valid before sending coins
  verifyWarranty(warranty, sig) {
    return utils.verifySignature(this.pendingMixRequestPubkeys.get(warranty.nonce), warranty, sig);
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
      returnAddr: this.address
    };

    this.rememberPendingMixRequest(request, mixerPubKey);
    this.net.sendMessage(mixerAddress, MixcoinConstants.REQUEST_MIX, request);
  }
};
