const { FakeNet } = require('spartan-gold');

module.exports = class MixcoinNet extends FakeNet {
  constructor(...args) {
    super(...args);
    // Create a new map that stores clients, but allows duplicates for access through different addresses
    this.registeredClients = new Map();
  }

  /**
   * Override Registers clients to the network.
   * Clients and Miners are registered by public key.
   *
   * @param {...Object} clientList - clients to be registered to this network (may be Client or Miner)
   */
  register(...clientList) {
    for (const client of clientList) {
      console.log(`Adding client ${client.address} ${client.name}`);
      this.clients.set(client.address, client);
      this.registeredClients.set(client.address, client);
    }
  }

  /**
   * Override Broadcasts to all clients within this.clients the message msg and payload o.
   *
   * @param {String} msg - the name of the event being broadcasted (e.g. "PROOF_FOUND")
   * @param {Object} o - payload of the message
   */
  broadcast(msg, o) {
    for (const address of this.registeredClients.keys()) {
      this.sendMessage(address, msg, o);
    }
  }

}