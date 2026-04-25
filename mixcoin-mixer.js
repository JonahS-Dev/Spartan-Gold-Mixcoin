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
  }

  // accept all requests
  reviewRequest(request) {
    console.log(`RECEIVED REQUEST ${request}`);
    return { status: MixcoinConstants.STATUS_ACCEPTED, requestId: request.requestId };
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