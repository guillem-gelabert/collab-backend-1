'use strict';
const opCont = require (__dirname + '/operationController');
const db = require( __dirname + '/../models/' );



module.exports.getPendingOperations = async (ctx) => {
  const operations = await db.Operation.findAll({
    where: {result: 'pending'},
    include: [
      {
        model: db.Vote,
        include: [
          {
            model: db.UserWallet,
            include: [
              {
                model: db.User,
                where: {username: ctx.user.username},
              }
            ]
          }
        ]
      }
    ]
  });
  let result =[];
  for (let operation of operations) {
    let numberOfVotes = 0;
    let votingState = 0;
    let publicKey = '';
    for (let vote of operation.dataValues.Votes) {
      if (vote.dataValues.UserWallet) {
        publicKey = vote.dataValues.UserWallet.dataValues.wallet_id;
        if (vote.dataValues.value) votingState = vote.dataValues.value;
      }
      if (vote.dataValues.value) numberOfVotes ++;
    }
    let pendingOp = {
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
  ctx.jwt.modified = true;
  ctx.body ={operations:result};
};


// evaluates votes
module.exports.evalVotes = (oId, votes) => {
  const voteCount = votes.length;
  const affirmativeVoteCount = votes.filter(vote => vote.dataValues.value === 1).length;
  if (affirmativeVoteCount >= voteCount) opCont.executeOperation( oId, votes );
  else opCont.rejectOperation(oId, votes);
};

module.exports.vote = async (ctx) => {
  const { valueOfVote, operation_id, publicKey } = ctx.request.body;
  // console.log('vote params in vote controller', Object.keys(ctx.request.body));

  if (valueOfVote !== 1 && valueOfVote !== 2) return ctx.body = {error: 'Value of the vote invalid'};
  //get userAuth Id
  const userId = await db.User.findOne({ where:
    { username:ctx.user.username},
  attributes: ['id']
  });

  //get userWallet id
  const userWalletId = await db.UserWallet.findOne({ where:
    { user_id: userId.id, wallet_id: publicKey},
  attributes: ['id']
  });
  if (!userWalletId) return ctx.body = {error: 'User has no rights ver this wallet'};

  const vote = await db.Vote.findOne({ where:
    {userwallet_id:userWalletId.id, operation_id: operation_id}
  });
  if(!vote) return ctx.body = {error: 'User has not rights over this operation'};
  if(vote.dataValues.value) return ctx.body = {error: 'User has already voted'};

  const result = await vote.updateAttributes({
    value: valueOfVote
  });
  if(!result) return ctx.body = {error: 'DB error on updating'};

  ctx.jwt.modified = true;
  ctx.body = {
    'operation_id':operation_id,
    'publicKey': publicKey};

  this.evalVotes(operation_id);
};
