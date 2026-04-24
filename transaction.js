"use strict";

const utils = require('./utils.js');

// String constants mixed in before hashing.
const TX_CONST = "TX";

/**
 * A UTXO transaction can spend funds from multiple input addresses.
 * Each input UTXO is consumed, and the transaction creates new output
 * UTXOs with an optional miner transaction fee.
 */
module.exports = class Transaction {

  /**
   * The constructor for a transaction includes an array of outputs, meaning
   * that one transaction can pay multiple parties. An output is a pair of an
   * amount of gold and the hash of a public key (also called the address),
   * in the form:
   *    {amount, address}
   * 
   * @constructor
   * @param {Object} obj - The inputs and outputs of the transaction.
   * @param {Array} obj.from - The addresses of the payer.
   * @param obj.nonce - Number that orders the payer's transactions.
   * @param {Array} obj.pubKey - Public keys associated with the specified from address.
   * @param {Array} obj.sig - Signatures of the transaction.
   * @param {Array} [obj.outputs] - An array of the outputs.
   * @param [obj.fee] - The amount of gold offered as a transaction fee.
   * @param [obj.data] - Object with any additional properties desired for the transaction.
   */
  constructor({from, nonce=0, pubKey, sig=[], outputs, fee=0, data={}}) {
    this.from = from || [];
    this.nonce = nonce;
    this.pubKey = pubKey || [];
    this.sig = sig;
    this.fee = fee;
    this.outputs = [];
    if (outputs) outputs.forEach(({amount, address}) => {
      if (typeof amount !== 'number') {
        amount = parseInt(amount, 10);
      }
      this.outputs.push({amount, address});
    });
    this.data = data;
  }

  /**
   * A transaction's ID is derived from its contents.
   */
  get id() {
    return utils.hash(TX_CONST + JSON.stringify({
      from: this.from,
      nonce: this.nonce,
      pubKey: this.pubKey,
      outputs: this.outputs,
      fee: this.fee,
      data: this.data }));
  }

  /**
   * Signs a transaction and stores the signature in the transaction.
   * 
   * @param privKey  - The key used to sign the signature.  It should match the
   *    public key included in the transaction.
   */
  sign(privKey) {
    this.sig.push(utils.sign(privKey, this.id));
  }

  /**
   * Determines whether the signature of the transaction is valid
   * and if the from address matches the public key.
   * 
   * @returns {Boolean} - Validity of the signature and from address.
   */
  validSignature() {
    for (let i = 0; i < this.from.length; i++) {
      // verify that address matches the public key
      if (!utils.addressMatchesKey(this.from[i], this.pubKey[i])) {
        return false;
      }

      // verify there is a signature
      if (this.sig[i] === undefined) {
        return false;
      }

      // verify the signature of this.id is valid for the public key
      if (!utils.verifySignature(this.pubKey[i], this.id, this.sig[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verifies that there is currently sufficient gold for the transaction.
   * 
   * @param {Block} block - Block used to check current balances
   * 
   * @returns {boolean} - True if there are sufficient funds for the transaction,
   *    according to the balances from the specified block.
   */
  sufficientFunds(block) {
    return this.totalOutput() <= this.totalInput(block);
  }

  /**
   * Calculates the sum of all inputs.
   *
   * @param {Block} block - Block used to look up UTXO balances
   *
   * @returns {Number} - Total amount of gold available from all inputs
   */
  totalInput(block) {
    let total = 0;

    for(let address of this.from) {
      total = total + block.balanceOf(address);
    }

    return total;
  }

  /**
   * Calculates the total value of all outputs, including the transaction fee.
   * 
   * @returns {Number} - Total amount of gold given out with this transaction.
   */
  totalOutput() {
    return this.outputs.reduce( (totalValue, {amount}) => totalValue + amount, this.fee);
  }
};
