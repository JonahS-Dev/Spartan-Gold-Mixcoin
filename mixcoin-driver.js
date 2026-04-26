"use strict";

const { Blockchain, FakeNet } = require('spartan-gold');

const UtxoBlock = require('./utxo-block.js');
const UtxoClient = require('./utxo-client.js');
const UtxoMiner = require('./utxo-miner.js');
const UtxoTransaction = require('./utxo-transaction.js');
const MixcoinMixer = require('./mixcoin-mixer.js');
const MixcoinClient = require('./mixcoin-client.js');
const MixcoinConstants = require('./mixcoin-constants.js');

/**
 * BASING OFF OF part2.js 
*/

console.log("Starting simulation.  This may take a moment...");

let fakeNet = new FakeNet();

// Clients
let alice = new UtxoClient({name: "Alice", net: fakeNet});
let bob = new UtxoClient({name: "Bob", net: fakeNet});
let charlie = new UtxoClient({name: "Charlie", net: fakeNet});

// Mixcoin Clients
let alCapone = new MixcoinClient({name: "alCapone", net: fakeNet});

// Mixers
let pabloEscobar = new MixcoinMixer({name: "pabloEscobar", net: fakeNet});

// Miners
let minnie = new UtxoMiner({name: "Minnie", net: fakeNet});
let mickey = new UtxoMiner({name: "Mickey", net: fakeNet});

// Creating genesis block
let genesis = Blockchain.makeGenesis({
  blockClass: UtxoBlock,
  transactionClass: UtxoTransaction,
  clientBalanceMap: new Map([
    [alice, 233],
    [bob, 99],
    [charlie, 67],
    [alCapone, 67],
    [pabloEscobar, 67],
    [minnie, 200],
    [mickey, 200],
  ]),
});

function showBalances() {
  console.log();
  console.log(`Alice's balance is ${alice.availableGold}.`);
  alice.showAllUtxos();

  console.log();
  console.log(`Bob's balance is ${bob.availableGold}.`);
  bob.showAllUtxos();

  console.log();
  console.log(`Charlie's balance is ${charlie.availableGold}.`);
  charlie.showAllUtxos();

  console.log();
  console.log(`Al Capones' balance is ${alCapone.availableGold}.`);
  alCapone.showAllUtxos();

  console.log();
  console.log(`Pablo Escobar's balance is ${pabloEscobar.availableGold}.`);
  pabloEscobar.showAllUtxos();

  console.log();
  console.log(`Minnie's balance is ${minnie.availableGold}.`);
  minnie.showAllUtxos();

  console.log();
  console.log(`Mickey's balance is ${mickey.availableGold}.`);
  mickey.showAllUtxos();
}

// Showing the initial balances from Alice's perspective, for no particular reason.
console.log("Initial balances:");
showBalances();

fakeNet.register(alice, bob, charlie, alCapone, pabloEscobar, minnie, mickey);

// Miners start mining.
minnie.initialize();
mickey.initialize();

// Alice transfers some money to Bob.
let addr = bob.createAddress();
console.log();
console.log(`***Alice is transferring 40 gold to Bob at address ${addr}`);
console.log();
alice.postTransaction([{ amount: 40, address: addr }]);

/* 
 * NEW TRANSACTIONS HERE
*/
setTimeout(() => {
  console.log();
  showBalances();
  let mixerAddr = pabloEscobar.createAddress();
  let inputAddr = alCapone.address;
  let outputAddr = alCapone.createAddress();
  console.log();
  console.log(`***Al Capone is requesting a mix from Pablo Escobar at address ${mixerAddr}`);
  console.log();
  alCapone.requestMix(mixerAddr, MixcoinConstants.STANDARD_CHUNK_SIZE, inputAddr, outputAddr, Date.now());
}, 500);

/*
 * END OF NEW TRANSACTIONS
*/
// Print out the final balances after it has been running for some time.
setTimeout(() => {
  console.log();
  showBalances();

  console.log();
  console.log("Showing all UTXOs, unorganized:");
  alice.showAllBalances();

  console.log();
  console.log(`Minnie's chain length is ${minnie.currentBlock.chainLength}.`);

  process.exit(0);
}, 2000);

