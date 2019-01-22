'use strict';
const operationController = require('./operationController');

const db = require( __dirname + '/../models/');

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
  if (affirmativeVoteCount >= voteCount) operationController.executeOperation(oId, votes);
  else operationController.rejectOperation(oId, votes);
};

module.exports.vote = async (ctx, next) => {
  if (ctx.method !== 'GET') await next();
  try {
    const { valueOfVote, operation_id, publicKey } = ctx.request.body;
    const { username } = ctx.user;
    const { id: userId} = await db.User.findOne({ where: { username }});
    const { id: userwallet_id} = await db.UserWallet.findOne({ where:
      { user_id: userId, wallet_id: publicKey},
    attributes: ['id']
    });
    const vote = await db.Vote.findOne({ where: { userwallet_id, operation_id }});

    if (!userwallet_id || !vote) return ctx.body = { error: 'User has no rights for this wallet' };
    if(vote.dataValues.value) return ctx.body = { error: 'User has already voted' };
    const result = await vote.updateAttributes({
      value: valueOfVote
    });

    if(!result) return ctx.body = {error: 'DB error on updating'};

    ctx.jwt.modified = true;
    ctx.body = {operation_id, publicKey};

    this.evalVotes(operation_id);

  } catch (error) {
    console.error(error); // eslint-disable-line no-console
  }
};