'use strict';

require('iconv-lite').encodingExists('cesu8');

const wallet = require('../../services/wallet');
const mocks = require('../__mocks__/wallets');
const request = require('../../services/request');
const operationController = require('../../controllers/operationController');
const { evalVotes } = require('../../controllers/voteController');

describe.only('evalVotes', () => {
  it('calls executeOperation if all votes are affirmative', () => {
    const spy = jest.spyOn(operationController, 'executeOperation');
    evalVotes(mocks.oId, mocks.mockVotes.allAffirmative);
    expect(spy).toHaveBeenCalled(); 
  });

  it('calls executeOperation if all votes are negative', () => {
    const spy = jest.spyOn(operationController, 'rejectOperation');
    evalVotes(mocks.oId, mocks.mockVotes.allNegative);
    expect(spy).toHaveBeenCalled(); 
  });

  it('calls executeOperation if not all votes are affirmative', () => {
    const spy = jest.spyOn(operationController, 'rejectOperation');
    evalVotes(mocks.oId, mocks.mockVotes.mixed);
    expect(spy).toHaveBeenCalled(); 
  });
});

describe('createWallet', () => {
  it('Returns an object with 3 properties', () => {
    return expect(Object.values(wallet.createWallet()).length).toEqual(3);
  });

  it('Properties should be string type', () => {
    const properties = Object.values(wallet.createWallet());
    return expect(properties.every(prop => typeof prop === 'string')).toBe(true);
  });
});

describe('getWalletBalance', () => {
  it('Returns a number', async () => {
    const response = await wallet.getWalletBalance(mocks.wallet1.address);
    return expect(typeof response).toBe('number');
  });

  /** This test could start failing if the testingWallet receives a transaction. */
  it('Returns the total number of satoshis in the wallet', async () => {
    const response = await wallet.getWalletBalance(mocks.testingWallet.address);
    return expect(response).toBe(21000);
  });

  it('Logs an error if argument is not a correct public addres', async () => {
    const spy = jest.spyOn(global.console, 'error');

    wallet.getWalletBalance('not an addres!');
    expect(spy).toHaveBeenCalled();
  });
});

describe('getUTXOS', () => {
  it('Returns an array', async () => {
    const response = await wallet.getUTXOS(mocks.testingWallet.address);
    expect(Array.isArray(response)).toBe(true);
  });

  it('Returns an empty array if there are not UTXOS', async () => {
    const response = await wallet.getUTXOS(mocks.emptyTestingWallet.address);
    expect(response).toEqual([]);
  });
});

describe('getTransactions', () => {
  it('Returns an array', async () => {
    const transactions = await wallet.getTransactions(mocks.testingWallet.address);

    expect(Array.isArray(transactions)).toBe(true);
  });

  it('Returns an array with the transactions of an address sorted by time', async () => {
    let transactions = await wallet.getTransactions(mocks.testingWallet.address);

    //only test for transaction id, as transaction confirmations increase over time.
    transactions = transactions.map(el => el.txid);
    expect(transactions).toEqual(mocks.testingWalletTransactions);
  });
});

describe('getInbTransactions', () => {
  it('Returns an array', async () => {
    const transactions = await wallet.getInbTransactions(mocks.testingWallet.address);

    expect(Array.isArray(transactions)).toBe(true);
  });

  it('Returns an array with transactions starting from a certain transaction', async () => {
    let transactions = await wallet.getInbTransactions(mocks.testingWallet.address, mocks.testingWalletTransactions[1]);

    //only test for transaction id, as transaction confirmations increase over time.
    transactions = transactions.map(el => el.txid);
    expect(transactions).toEqual([mocks.testingWalletTransactions[2]]);
  });
});
