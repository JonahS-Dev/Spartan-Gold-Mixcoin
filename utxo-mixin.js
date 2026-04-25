"use strict";

const { Blockchain, utils } = require('spartan-gold');

/**
 * Mixes in shared behavior between clients and miners for handling UTXO transactions.
 */
module.exports = {

  /**
   * In the UTXO model, a client should have a collection of addresses.
   * We refer to this collection as a "wallet".
   * 
   * In our design, the wallet will be a queue of addresses (first-in, first-out).
   * We represent this with an array.
   */
  setupWallet: function() {
    // A wallet has utxos of the form { address, keyPair }
    this.wallet = [];

    // Adding initial balance to wallet.
    this.wallet.push({ address: this.address, keyPair: this.keyPair });
  },

  /**
   * With the UTXO model, we must sum up all balances associated with
   * addresses in the wallet.
   */
  getConfirmedBalance: function() {
    // Go through all addresses and get the balances according to
    // the last confirmed block, then return the total.

    //
    // **YOUR CODE HERE**
    //

    let total = 0;
    let addresses = new Set([]);

    // include current address
    addresses.add(this.address);

    // and all addresses in wallet
    for (let { address } of this.wallet) {
      addresses.add(address);
    }

    // add each address's balance to the total
    for (let address of addresses) {
      total = total + this.lastConfirmedBlock.balanceOf(address);
    }

    return total;

  },

  /**
   * Creates a new address/keypair combo and adds it to the wallet.
   * 
   * @returns Newly created address.
   */
  createAddress: function() {
    // Create a new keypair, derive the address from the public key,
    // add these details to the wallet, and return the address.

    //
    // **YOUR CODE HERE**
    //
    // push current address and keypair onto the wallet (if not already present)
    let duplicate = false;
    for (let entry of this.wallet) {
      if (entry.address === this.address) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate) {
      this.wallet.push({
        address: this.address,
        keyPair: this.keyPair
      });
    }

    // create new keypair
    this.keyPair = utils.generateKeypair();

    // FIXME: If the network starts sending to undefined addresses, it's probably because I added this
    // but the idea is to change the address associated with the fake-net.sendMessage() method
    // because we update this.address in this method but the address in fake-net stays the same.
    // If we need to, we can just use a constant address, but we can try to make the address to send
    // to by changing here 
    // Edit the network's client mapping to use the new addresses
    this.net.clients.delete(this.address);

    // derive new address from new public key
    this.address = utils.calcAddress(this.keyPair.public);

    // FIXME: and here
    // Add the new address
    this.net.clients.set(this.address, this);

    // save keypair and address
    this.wallet.push({
      address: this.address,
      keyPair: this.keyPair
    });

    // return address
    return this.address;
  },

  /**
   * Utility method that prints out a table of all UTXOs.
   * (That is, the amount of gold for all addresses that
   * have not yet been spent.)
   * 
   * This table also includes a "**TOTAL**" entry at the end
   * summing up the total amount of UTXOs.
   */
  showAllUtxos: function() {
    let table = [];
    this.wallet.forEach(({ address }) => {
      let amount = this.lastConfirmedBlock.balanceOf(address);
      table.push({ address: address, amount: amount });
    });
    table.push({ address: "***TOTAL***", amount: this.confirmedBalance });
    console.table(table);
  },

  /**
   * Broadcasts a transaction from the client giving gold to the clients
   * specified in 'outputs'. A transaction fee may be specified, which can
   * be more or less than the default value.
   * 
   * The method gathers sufficient UTXOs, starting with the oldest addresses
   * in the wallet.  If the amount of gold exceeds the amount needed, a
   * new "change address" is created, which will receive any additional coins.
   * 
   * @param {Array} outputs - The list of outputs of other addresses and
   *    amounts to pay.
   * @param {number} [fee] - The transaction fee reward to pay the miner.
   * 
   * @returns {Transaction} - The posted transaction.
   */
  postTransaction: function(outputs, fee=Blockchain.DEFAULT_TX_FEE) {

    // Calculate the total value of gold needed and make sure the client has sufficient gold.
    //
    // If they do, gather up UTXOs from the wallet (starting with the oldest) until the total
    // value of the UTXOs meets or exceeds the gold required.
    //
    // Determine by how much the collected UTXOs exceed the total needed.
    // Create a new address to receive this "change" and add it to the list of outputs.
    //
    // Call `Blockchain.makeTransaction`, noting that 'from' and 'pubKey' are arrays
    // instead of single values.  The nonce field is not needed, so set it to '0'.
    //
    // Once the transaction is created, sign it with all private keys for the UTXOs used.
    // The order that you call the 'sign' method must match the order of the from and pubKey fields.


    //
    // **YOUR CODE HERE**
    //

    // sum the requested outputs and add the fee
    let paymentAmount = 0;
    for (let { amount } of outputs) {
      paymentAmount = paymentAmount + amount;
    }
    let totalPayments = paymentAmount + fee;

    // make sure client has enough gold
    if (totalPayments > this.availableGold) {
      throw new Error(`Requested ${totalPayments}, but account only has ${this.availableGold}.`);
    }

    // build UTXO arrays
    let from = [];
    let publicKeys = [];
    let privateKeys = [];
    let totalInput = 0;

    // gather oldest UTXOs until we have enough gold
    for (let { address, keyPair } of this.wallet) {
      let amount = this.lastConfirmedBlock.balanceOf(address);
      if (amount <= 0) {
        continue;
      }

      // save to UTXO arrays
      from.push(address);
      publicKeys.push(keyPair.public);
      privateKeys.push(keyPair.private);
      totalInput = totalInput + amount;

      // once enough UTXOs are gathered, break out of the loop
      if (totalInput >= totalPayments) {
        break;
      }
    }

    // if there is more gold than needed, send to a change address
    let change = totalInput - totalPayments;
    if (change > 0) {
      let changeAddress = this.createAddress();
      outputs.push({
        amount: change,
        address: changeAddress
      });
    }

    // make blockchain transaction with a nonce of 0 (not needed)
    let tx = Blockchain.makeTransaction({
      from: from,
      nonce: 0,
      pubKey: publicKeys,
      outputs: outputs,
      fee: fee,
    });

    // sign in the same order as from/pubKey feilds
    for (let i = 0; i < privateKeys.length; i++) {
      let privateKey = privateKeys[i];
      tx.sign(privateKey);
    }

    // remove consumed input UTXOs from wallet
    // create a set of addresses using from (inputs)
    let spentAddresses = new Set(from);

    // if an address was used as an input, remove it from wallet (filter out
    // spent addresses)
    this.wallet = this.wallet.filter(({ address }) => !spentAddresses.has(address));


    // Adding transaction to pending.
    this.pendingOutgoingTransactions.set(tx.id, tx);

    this.net.broadcast(Blockchain.POST_TRANSACTION, tx);

    // If the client is a miner, add the transaction to the current block.
    if (this.addTransaction !== undefined) {
      this.addTransaction(tx);
    }

    return tx;
  },
  
}
