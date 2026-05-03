"use strict";

const UtxoClient = require("./utxo-client.js");
const MixcoinConstants = require("./mixcoin-constants.js");
const { Blockchain, utils } = require('spartan-gold');
const MixcoinMixer = require('./mixcoin-mixer.js');

/**
 * A MixCoin mixer node that cheats.
 */
module.exports = class MixcoinCheatingMixer extends MixcoinMixer {
  constructor(...args) {
    super(...args);
  }

  // doesn't collect coins, shuffle them, and send them back
  mixCoins(requestIds) {
    console.log("Cheating mixer doesn't post the transaction");
  }
};