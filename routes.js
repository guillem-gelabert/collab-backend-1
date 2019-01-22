'use strict';
const router = require('koa-router')();
const authorize = require(__dirname + '/middleware/auth');

const userCont = require(__dirname + '/controllers/userController');
const walletCont = require(__dirname + '/controllers/walletController');
const operationController = require(__dirname + '/controllers/operationController');

const voteCont = require(__dirname + '/controllers/voteController');
const emailCont = require(__dirname + '/controllers/emailController');

router
  .get('/transactions/:walletid', authorize, walletCont.getTxFromWallet)
  .get('/wallet', authorize, walletCont.getWallets)
  .get('/operations/history', authorize, operationController.getOperationHistory)
  .get('/operations/history/:wallet_id', authorize, operationController.getOperationHistoryWid)
  .get('/operations/pending', authorize, voteCont.getPendingOperations)
  .get('/operations/pending/:wallet_id', authorize, operationController.getPendingOperationsSpecificWallet)
  .get('/operations/:operation_id', authorize, operationController.getOperation)

  .post('/vote', authorize, voteCont.vote)
  .post('/wallet/add_user', authorize, operationController.createOperation)
  .post('/operations', authorize, operationController.createOperation)
  .post('/wallet', authorize, walletCont.createWallet)

  .get('/emailVal/:key', emailCont.checkValidEmail)
  .get('/emailVote/:key', emailCont.voteEmail)
  .post('/login', userCont.signIn)
  .post('/register', userCont.createUser);

module.exports = router;
