"use strict";

const UtxoClient = require("./utxo-client.js");
const MixcoinConstants = require("./mixcoin-constants.js");
const { FakeNet, utils } = require('spartan-gold');

/**
 * Add Mixcoin client behavior on top of the UTXO client
 */
module.exports = class MixcoinClient extends UtxoClient {
  constructor(...args) {
    super(...args);

    // store submitted mixing requests
    this.pendingMixRequests = new Map();

    // store promises/warranties from mixers to use as evidence
    this.warranties = new Map();

    this.setupResponseListener();
  }

  setupResponseListener() {
    this.on(MixcoinConstants.REQUEST_MIX_RESPONSE, (response) => {
      console.log(`RECEIVED RESPONSE ${response}`);
      console.log(`Response Status ${response.status}`);
    });
  }

  // remember sent mixing requests to see the outcome later
  rememberPendingMixRequest(request) {
    this.pendingMixRequests.set(request.requestId, request);
  }

  // store warranties from mixers to use as evidence in the future
  rememberWarranty(warranty) {
    this.warranties.set(warranty.requestId, warranty);
  }

  // send a mix request to a mixer
  requestMix(mixerAddress, amount, outputAddress) {
    // create request, sign it, then broadcast it similar to how
    // postTransaction works on utxo-mixin
    console.log("REQUSTING MIX");
    
    //sendMessage(address, msg, o)
    this.net.sendMessage(mixerAddress, MixcoinConstants.REQUEST_MIX, {test: "ksjflkasjlfksjl", returnAddr: this.address});
  }
};
