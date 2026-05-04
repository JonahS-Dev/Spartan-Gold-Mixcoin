"use strict";

const { Blockchain, FakeNet } = require('spartan-gold');

const UtxoBlock = require('./utxo-block.js');
const UtxoClient = require('./utxo-client.js');
const UtxoMiner = require('./utxo-miner.js');
const UtxoTransaction = require('./utxo-transaction.js');
const MixcoinMixer = require('./mixcoin-mixer.js');
const MixcoinClient = require('./mixcoin-client.js');
const MixcoinConstants = require('./mixcoin-constants.js');
const MixcoinNet = require('./mixcoin-net.js');

/**
 * BASING OFF OF part2.js 
*/

console.log("Starting simulation.  This may take a moment...");

let fakeNet = new MixcoinNet();

// Clients
let alice = new UtxoClient({name: "Alice", net: fakeNet});
let bob = new UtxoClient({name: "Bob", net: fakeNet});
let charlie = new UtxoClient({name: "Charlie", net: fakeNet});

// Mixcoin Clients
let alCapone = new MixcoinClient({name: "alCapone", net: fakeNet});
let samBankmanFried = new MixcoinClient({name: "samBankmanFried", net: fakeNet});
let meyerLansky = new MixcoinClient({name: "meyerLansky", net: fakeNet});
let ferdinandMarcos = new MixcoinClient({name: "ferdinandMarcos", net: fakeNet});

// Mixers
let pabloEscobar = new MixcoinMixer({name: "pabloEscobar", net: fakeNet});

// // testing: preventing the mixer from sending return funds
// pabloEscobar.mixCoins = function(requestIds) {
//   console.log("skipping mixer payout");
//   return null;
// };

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
    [alCapone, 167],
    [samBankmanFried, 167],
    [meyerLansky, 167],
    [ferdinandMarcos, 167],
    [pabloEscobar, 467],
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
  console.log(`Sam Bankman-Fried's balance is ${samBankmanFried.availableGold}.`);
  samBankmanFried.showAllUtxos();

  console.log();
  console.log(`Meyer Lansky's balance is ${meyerLansky.availableGold}.`);
  meyerLansky.showAllUtxos();

  console.log();
  console.log(`Ferdinand Marcos' balance is ${ferdinandMarcos.availableGold}.`);
  ferdinandMarcos.showAllUtxos();

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

fakeNet.register(alice, bob, charlie, alCapone, samBankmanFried, meyerLansky, ferdinandMarcos, pabloEscobar, minnie, mickey);

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

function requestValidMix(mixer, client) {
  setTimeout(() => {
    console.log();
    showBalances();
    let mixerAddr = mixer.address;
    let inputAddr = client.address;
    let outputAddr = client.createAddress();
    console.log();
    console.log(`***${client.name} is requesting a mix from ${mixer.name} at address ${mixerAddr}`);
    console.log();
    let clientDeadline = new Date(Date.now());
    clientDeadline.setSeconds(clientDeadline.getSeconds() + 1);
    clientDeadline = clientDeadline.getTime();

    client.requestMix(mixerAddr, MixcoinConstants.STANDARD_CHUNK_SIZE, inputAddr, outputAddr, clientDeadline, mixer.keyPair.public);
  }, 2000);
}

// Set alCapone to not pay the mixer to test
alCapone.payMixer = false;
requestValidMix(pabloEscobar, alCapone);
requestValidMix(pabloEscobar, samBankmanFried);
requestValidMix(pabloEscobar, meyerLansky);
requestValidMix(pabloEscobar, ferdinandMarcos);

setTimeout(() => {
  alCapone.broadcastAllWarranties();
}, 10000);


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

  console.log();
  alCapone.broadcastAllWarranties();


  
}, 12000);

setTimeout(() => {
  process.exit(0);
}, 13000);
