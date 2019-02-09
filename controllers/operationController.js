
class OperationController {
  constructor(db, sendEmail, makeTransaction, userWalletController, cryptoSer) {
  
    this.db = db;
    this.sendEmail = sendEmail;
    this.makeTransaction = makeTransaction;
    this.userWalletController = userWalletController;
    this.cryptoSer = cryptoSer;

    this.getPendingOperationsSpecificWallet = this.getPendingOperationsSpecificWallet.bind(this);
    this.executeOperation = this.executeOperation.bind(this);
    this.rejectOperation = this.rejectOperation.bind(this);
    this.getOperationHistoryWid = this.getOperationHistoryWid.bind(this);
    this.getAllOperationsWallet = this.getAllOperationsWallet.bind(this);
    this.getOperationHistory = this.getOperationHistory.bind(this);
    this.getOperation = this.getOperation.bind(this);
    this.createVotes = this.createVotes.bind(this);
    this.createOperation = this.createOperation.bind(this);
  }

  async getPendingOperationsSpecificWallet(ctx) {
    const operations = await this.db.Operation.findAll({
      where: { result: 'pending' },
      include: [
        {
          model: this.db.Vote,
          include: [
            {
              model: this.db.UserWallet,
              include: [
                {
                  model: this.db.User,
                  where: { username: ctx.user.username }
                }
              ]
            }
          ]
        }
      ]
    });

    let result = [];
    for (let operation of operations) {
      if (
        operation.dataValues.Votes[0].dataValues.UserWallet.dataValues
          .wallet_id === ctx.params.wallet_id
      ) {
        let numberOfVotes = 0;
        let votingState = 0;
        let publicKey = '';
        for (let vote of operation.dataValues.Votes) {
          if (vote.dataValues.UserWallet) {
            publicKey = vote.dataValues.UserWallet.dataValues.wallet_id;
            if (vote.dataValues.value) votingState = vote.dataValues.value;
          }
          if (vote.dataValues.value) numberOfVotes++;
        }
        let pendingOp = {
          type: operation.dataValues.type,
          publicKey: publicKey,
          message: operation.dataValues.message,
          amount: operation.dataValues.amount,
          target: operation.dataValues.target,
          result: operation.dataValues.result,
          operation_id: operation.dataValues.id,
          votingState: votingState,
          numberOfVotes: numberOfVotes,
          numberOfUsers: operation.dataValues.Votes.length,
          user_to_act: operation.dataValues.user_to_act
        };
        result.push(pendingOp);
      }
    }
    ctx.jwt.modified = true;
    ctx.body = { operations: result };
  }

  async executeOperation(oId, votes) {
    let txRes;
    const operation = await this.db.Operation.findOne({
      where: { id: oId }
    });

    const result = await operation.updateAttributes({
      result: 'Approved',
      closed_at: Date.now()
    });

    if (result) {
      const uw = await this.db.UserWallet.findOne({
        where: { id: result.dataValues.userwallet_id }
      });
      const w = await this.db.Wallet.findOne({
        where: { publickey: uw.dataValues.wallet_id }
      });
      if (result.dataValues.type === 'adduser') {
        this.this.userWalletController.addUserToWallet(
          result.dataValues.user_to_act,
          w.dataValues.publickey
        );
      } else {
        try {
          txRes = await this.makeTransaction(
            w.dataValues.publickey,
            this.cryptoSer.decryptIv(w.dataValues.privatekey),
            operation.dataValues.target,
            operation.dataValues.amount
          );

          if (txRes) {
            const trans = await this.db.Transaction.create({
              type: 'outbound',
              amount: operation.dataValues.amount,
              counter_party: operation.dataValues.target,
              transaction_str: txRes,
              operation_id: operation.dataValues.id,
              wallet_id: w.dataValues.publickey,
              date: Date.now()
            });
            if (!trans)
              this.sendEmail.failedRecordingTransaction({
                type: 'outbound',
                amount: operation.dataValues.amount,
                counter_party: operation.dataValues.target,
                transaction_str: txRes,
                operation_id: operation.dataValues.id,
                wallet_id: w.dataValues.publickey
              });
          }
        } catch (e) {
          console.error(e); // eslint-disable-line no-console
        }
      }
      for (let vote of votes) {
        const user = await this.db.User.findOne({
          include: [
            {
              model: this.db.UserWallet,
              where: {
                id: vote.dataValues.userwallet_id
              }
            }
          ]
        });
        if (user.dataValues.valid_email) {
          // console.log('txRes:', txRes);
          //console.log('result.dataValues.type:', result.dataValues.type);
          if (txRes || result.dataValues.type === 'adduser')
            this.sendEmail.operationApproved(
              user.dataValues.email,
              operation.dataValues.message
            );
          else {
            await result.updateAttributes({
              result: 'Failed',
              closed_at: Date.now()
            });
            this.sendEmail.operationApprovethis.dbutfailed(
              user.dataValues.email,
              operation.dataValues.message
            );
          }
        }
      }
    }
  }

  async rejectOperation(oId, votes) {
    const operation = await this.db.Operation.findOne({ where: { id: oId } });
    const result = await operation.updateAttributes({
      result: 'Rejected',
      closed_at: Date.now()
    });
    if (result) {
      for (let vote of votes) {
        const user = await this.db.User.findOne({
          include: [
            {
              model: this.db.UserWallet,
              where: {
                id: vote.dataValues.userwallet_id
              }
            }
          ]
        });
        if (user.dataValues.valid_email)
          this.sendEmail.opearionRejected(
            user.dataValues.email,
            operation.dataValues.message
          );
      }
    }
  }

  async getOperationHistoryWid(ctx) {
    const uw = await this.db.User.findOne({
      where: { username: ctx.user.username },
      include: [
        {
          model: this.db.UserWallet,
          where: { wallet_id: ctx.params.wallet_id }
        }
      ]
    });
    if (!uw) return (ctx.body = { error: 'User has no right over this wallet' });

    const operations = await this.db.Operation.findAll({
      where: {
        $or: [{ result: 'Approved' }, { result: 'Rejected' }]
      },
      include: [
        {
          model: this.db.Vote,
          where: {
            userwallet_id: uw.dataValues.UserWallets[0].dataValues.id
          }
        }
      ]
    });
    let result = [];
    for (let operation of operations) {
      let votingState = 0;
      if (operation.dataValues.Votes[0].dataValues.value)
        votingState = operation.dataValues.Votes[0].dataValues.value;
      let pendingOp = {
        type: operation.dataValues.type,
        publicKey: ctx.params.wallet_id,
        message: operation.dataValues.message,
        amount: operation.dataValues.amount,
        target: operation.dataValues.target,
        result: operation.dataValues.result,
        operation_id: operation.dataValues.id,
        votingState: votingState,
        user_to_act: operation.dataValues.user_to_act,
        closed_at: operation.closed_at
      };
      result.push(pendingOp);
    }
    ctx.jwt.modified = true;
    ctx.body = result;
  }

  async getAllOperationsWallet(key) {
    const result = [];
    const operations = await this.db.Operation.findAll({
      include: [
        {
          model: this.db.UserWallet,
          where: {
            wallet_id: key
          }
        }
      ]
    });
    for (let op of operations) {
      const votes = await this.db.Vote.findAll({
        where: { operation_id: op.dataValues.id }
      });
      const numberOfUsers = votes.length;
      let numberOfVotes = 0;
      let numberOfAccepted = 0;
      let numberOfRejected = 0;
      for (let vote of votes) {
        if (vote.dataValues.value) {
          numberOfVotes++;
          if (vote.dataValues.value === 1) numberOfAccepted++;
          else if (vote.dataValues.value === 2) numberOfRejected++;
        }
      }

      const opToPush = {
        type: op.dataValues.type,
        publicKey: key,
        message: op.dataValues.message,
        amount: op.dataValues.amount,
        target: op.dataValues.target,
        result: op.dataValues.result,
        operation_id: op.dataValues.id,
        numberOfAccepted: numberOfAccepted,
        numberOfRejected: numberOfRejected,
        numberOfVotes: numberOfVotes,
        numberOfUsers: numberOfUsers,
        user_to_act: op.dataValues.user_to_act,
        closed_at: op.closed_at
      };
      result.push(opToPush);
    }
    return result;
  }

  async getOperationHistory(ctx) {
    const operations = await this.db.Operation.findAll({
      where: {
        $or: [{ result: 'Approved' }, { result: 'Rejected' }]
      },
      include: [
        {
          model: this.db.Vote,
          include: [
            {
              model: this.db.UserWallet,
              include: [
                {
                  model: this.db.User,
                  where: { username: ctx.user.username }
                }
              ]
            }
          ]
        }
      ]
    });
    let result = [];
    for (let operation of operations) {
      let numberOfVotes = 0;
      let votingState = 0;
      let publicKey = '';
      for (let vote of operation.dataValues.Votes) {
        if (vote.dataValues.UserWallet) {
          publicKey = vote.dataValues.UserWallet.dataValues.wallet_id;
          if (vote.dataValues.value) votingState = vote.dataValues.value;
        }
        if (vote.dataValues.value) numberOfVotes++;
      }
      let pendingOp = {
        type: operation.dataValues.type,
        publicKey: publicKey,
        message: operation.dataValues.message,
        amount: operation.dataValues.amount,
        target: operation.dataValues.target,
        result: operation.dataValues.result,
        operation_id: operation.dataValues.id,
        votingState: votingState,
        numberOfVotes: numberOfVotes,
        numberOfUsers: operation.dataValues.Votes.length,
        user_to_act: operation.dataValues.user_to_act,
        closed_at: operation.closed_at
      };
      result.push(pendingOp);
    }
    ctx.jwt.modified = true;
    ctx.body = result;
  }

  async getOperation(ctx) {
    //get de UserAuth Id
    const userId = await this.db.User.findOne({
      where: { username: ctx.user.username },
      attributes: ['id']
    });

    //get all votes of this operation
    const votes = await this.db.UserWallet.findAll({
      include: [
        {
          model: this.db.Vote,
          where: {
            operation_id: ctx.params.operation_id
          }
        }
      ]
    });
    let userHasRights = false;
    let numberOfUsers = votes.length;
    let numberOfVotes = 0;
    let valueOfVote = 0;
    for (let el of votes) {
      if (el.user_id === userId.id) {
        userHasRights = true;
        if (el.Votes[0].value) valueOfVote = el.Votes[0].value;
      } else if (el.Votes[0].value) numberOfVotes++;
    }
    if (!userHasRights)
      ctx.body = { error: 'User has no rights over this operation ' };

    //get info of this operation
    const operation = await this.db.Operation.findOne({
      where: { id: ctx.params.operation_id },
      attributes: ['type', 'target', 'amount', 'message', 'result', 'user_to_act']
    });

    //send the info to the frontend
    ctx.jwt.modified = true;
    ctx.body = {
      ...operation.dataValues,
      numberOfVotes: numberOfVotes,
      numberOfUsers: numberOfUsers,
      valueOfVote: valueOfVote,
      type: operation.dataValues.type,
      user_to_act: operation.dataValues.user_to_act
    };
  }

  async createVotes(
    ctx,
    opId,
    wId,
    opMsg,
    amount,
    type,
    username
  ) {
    let error = false;
    let uwIds = await this.db.UserWallet.findAll({ where: { wallet_id: wId } });
    for (let uw of uwIds) {
      let vote = await this.db.Vote.create({
        userwallet_id: uw.dataValues.id,
        operation_id: opId
      });
      let user = await this.db.User.findOne({ where: { id: uw.dataValues.user_id } });
      if (user.dataValues.valid_email)
        sendVoteEmail(
          ctx,
          amount,
          user.dataValues,
          opMsg,
          uw.dataValues.id,
          opId,
          type,
          username
        );
      if (!vote) error = true;
    }
    return error;
  }

  async createOperation(ctx) {
    // console.log('create operation controller', ctx.request.body);
    //get userAuth Id
    let userId = await this.db.User.findOne({
      where: { username: ctx.user.username },
      attributes: ['id']
    });
    //get id of UserWallet relation
    let userWalletId = await this.db.UserWallet.findOne({
      where: { user_id: userId.id, wallet_id: ctx.request.body.publicKey },
      attributes: ['id']
    });

    if (!userWalletId)
      return (ctx.body = { error: 'User has no rights over this wallet' });
    //create the operation
    let type;
    switch (ctx.url) {
    case '/wallet/add_user':
      type = 'adduser';
      break;
    default:
      type = 'transfer';
    }

    let operation = null;

    if (type === 'adduser') {
      const uExist = await this.db.User.findOne({
        where: { username: ctx.request.body.username }
      });
      if (!uExist) return (ctx.body = { error: 'This user not exist' });
      operation = await this.db.Operation.create({
        type: type,
        message: ctx.request.body.message,
        userwallet_id: userWalletId.id,
        user_to_act: ctx.request.body.username
      });
    } else {
      operation = await this.db.Operation.create({
        type: type,
        target: ctx.request.body.target_publicAdress,
        amount: ctx.request.body.amount,
        message: ctx.request.body.message,
        userwallet_id: userWalletId.id
      });
    }

    if (!operation) return (ctx.body = { error: 'this.db error on inserting' });
    
    //create all votes for this operation
    let error = await this.createVotes(
      ctx,
      operation.dataValues.id,
      ctx.request.body.publicKey,
      ctx.request.body.message,
      ctx.request.body.amount,
      type,
      ctx.request.body.username
    );
    if (!error) {
      ctx.jwt.modified = true;
      let result = {};
      if (operation.type === 'adduser')
        result = {
          type: type,
          message: ctx.request.body.message,
          userwallet_id: userWalletId.id,
          user_to_act: ctx.request.body.username,
          votingState: 0,
          publicKey: ctx.request.body.publicKey
        };
      else
        result = {
          type: type,
          target: ctx.request.body.target_publicAdress,
          amount: ctx.request.body.amount,
          message: ctx.request.body.message,
          userwallet_id: userWalletId.id,
          votingState: 0,
          publicKey: ctx.request.body.publicKey
        };
      return (ctx.body = result);
    }
    ctx.body = { error: 'this.db error on inserting votes' };
  }
}

module.exports = OperationController;