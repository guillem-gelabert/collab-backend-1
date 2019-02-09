'use strict';
const router = require('koa-router')();
const authorize = require(__dirname + '/middleware/auth');

// Dependencies
const db = require('./models');
const { makeTransaction } = require('./services/wallet');
const sendEmail = require('./services/mailer');
const cacheEmail = require('./services/cacheEmail');
const cryptoSer = require('./services/cryptoSer');

// Controller constructors
const UserWalletController = require(__dirname + '/controllers/userWalletController');
const OperationController = require(__dirname + '/controllers/operationController');
const VoteController = require(__dirname + '/controllers/voteController');
const EmailController = require(__dirname + '/controllers/emailController');

// Controller instances
const userWalletController = new UserWalletController(db);
const operationController = new OperationController(db, sendEmail, makeTransaction, userWalletController, cryptoSer);
const voteController = new VoteController(db);
const emailController = new EmailController(operationController, sendEmail, cacheEmail, db);
const userCont = require( __dirname + '/controllers/userController');
const walletCont = require( __dirname + '/controllers/walletController');

router
  .get('/transactions/:walletid', authorize, walletCont.getTxFromWallet)
  .get('/wallet', authorize, walletCont.getWallets)
  .get('/operations/history', authorize, operationController.getOperationHistory)
  .get('/operations/history/:wallet_id', authorize, operationController.getOperationHistoryWid)
  .get('/operations/pending', authorize, voteController.getPendingOperations)
  .get('/operations/pending/:wallet_id', authorize, operationController.getPendingOperationsSpecificWallet)
  .get('/operations/:operation_id', authorize, operationController.getOperation)

  .post('/vote', authorize, voteController.vote)
  .post('/wallet/add_user', authorize, operationController.createOperation)
  .post('/operations', authorize, operationController.createOperation)
  .post('/wallet', authorize, walletCont.createWallet)

  .get('/emailVal/:key', emailController.checkValidEmail)
  .get('/emailVote/:key', emailController.voteEmail)
  .post('/login', userCont.signIn)
  .post('/register', userCont.createUser);

module.exports = router;
