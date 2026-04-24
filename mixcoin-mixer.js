"use strict";

const UtxoClient = require("./utxo-client.js");
const MixcoinConstants = require("./mixcoin-constants.js");

/**
 * A MixCoin mixer node.
 */
module.exports = class MixcoinMixer extends UtxoClient {
  constructor(...args) {
    super(...args);
  }

  // accept all requests
  reviewRequest(request) {
    return { status: "accepted", requestId: request.requestId };
  }

  /**
   * listen for incoming mix requests from clients, then
   * accept or reject it
   */
  setupRequestListener() {
    this.on(MixcoinConstants.REQUEST_MIX, (request) => {
      let response = this.reviewRequest(request);

      // still need to send response back
    });
  }

  // collect coins, shuffle them, and send them back
  mixCoins(requestIds) {
    
  }
};