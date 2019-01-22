'use strict';
const sendMail = require(__dirname + '/../services/mailer');

const db = require(__dirname + '/../models/');
const cacheEmail = require(__dirname + '/../services/cacheEmail');
const voteCont = require(__dirname + '/voteController');

const uuidv4 = require('uuid/v4');

module.exports.sendValidationEmail = async (ctx, userData) => {
  const uniqueUrl = uuidv4();
  sendMail.emailValidator(userData, process.env.URL + '/emailVal/' + uniqueUrl);
  cacheEmail.setCache(uniqueUrl, JSON.stringify({ username: userData.username }));
};

module.exports.sendVoteEmail = async (ctx, amount, userData, msg, uwId, opId, type, username) => {
  const url = process.env.URL;
  const affirmativeVote = uuidv4();
  const negativeVote = uuidv4();
  const affirmativeVoteURL = url + '/emailVote/' + affirmativeVote;
  const negativeVoteURL = url + '/emailVote/' + negativeVote;

  await cacheEmail.setCache(affirmativeVote, JSON.stringify({
    username: userData.username,
    operation_id: opId,
    userWallet_id: uwId,
    value: 1,
    negativeVoteCache: negativeVote
  }));

  await cacheEmail.setCache(negativeVote, JSON.stringify({
    username: userData.username,
    operation_id: opId,
    userWallet_id: uwId,
    value: 2,
    affirmativeVoteCache: affirmativeVote
  }));

  sendMail.readyToVote(ctx.user.username, amount, userData, msg, affirmativeVoteURL, negativeVoteURL, type, username);
};


module.exports.checkValidEmail = async (ctx) => {
  const result = await cacheEmail.getCache(ctx.params.key);
  if (result) {
    const user = await db.User.findOne({
      where: { username: JSON.parse(result.data).username }
    });
    if (user) {
      const updated = await user.update({
        valid_email: true
      });
      if (updated) {
        cacheEmail.delFromCache(ctx.params.key);
        return ctx.redirect(process.env.FRONTEND_URL + '/validationpage');
      }
    }
  }
  ctx.redirect(process.env.FRONTEND_URL + '/errorvalidation');
};


// does it belong to vote controller?
module.exports.voteEmail = async (ctx, next) => {
  if (ctx.method !== 'GET') await next();
  try {
    const { key } = ctx.params;
    const result = await cacheEmail.getCache(key);
    const {
      value,
      operation_id,
      userWallet_id: userwallet_id 
    } = JSON.parse(result.data);
    await db.Vote.update({ value }, {where: { userwallet_id, operation_id }}); // TODO: check if vote exists
    const votes = await db.Vote.findAll({
      where: { operation_id },
      attributes: ['value', 'userwallet_id']
    });
    cacheEmail.delFromCache(key);
    voteCont.evalVotes(operation_id, votes);
    ctx.redirect(process.env.FRONTEND_URL + '/thanksmessage');
  } catch (error) {
    console.error('error occured while voting:', error); // eslint-disable-line no-console
    ctx.redirect(process.env.FRONTEND_URL + '/errorvoting');
  }
};   