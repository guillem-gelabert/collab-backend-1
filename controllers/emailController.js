'use strict';
const uuidv4 = require('uuid/v4');

class EmailController {
  constructor(operationController, sendEmail, cacheEmail, db) {
    this.operationController = operationController;
    this.sendEmail = sendEmail;
    this.db = db;
    this.cacheEmail = cacheEmail;
    this.sendValidEmail = this.sendValidEmail.bind(this);
    this.sendVoteEmail = this.sendVoteEmail.bind(this);
    this.checkValidEmail = this.checkValidEmail.bind(this);
    this.evalVotes = this.evalVotes.bind(this);
    this.voteEmail = this.voteEmail.bind(this);
  }
  async sendValidEmail(ctx, userData) {
    let uuid;
    let exist;
    do {
      uuid = uuidv4();
      exist = await this.cacheEmail.getCache(uuid);
    } while(exist);
    this.sendEmail.emailValidator(userData, process.env.URL + '/emailVal/' + uuid );
    this.cacheEmail.setCache( uuid, JSON.stringify({username:userData.username}));
  }
  
  async sendVoteEmail(ctx, amount, userData, msg, uwId, opId, type, username) {
    const url = process.env.URL;
    let ok;
    let ko;
    let exist;
    do {
      ok = uuidv4();
      exist = await this.cacheEmail.getCache(ok);
    } while(exist);
    do {
      ko = uuidv4();
      exist = await this.cacheEmail.getCache(ko);
    } while(exist);
    await this.cacheEmail.setCache( ok, JSON.stringify({
      username:userData.username,
      operation_id: opId,
      userWallet_id: uwId,
      value: 1,
      koCache: ko
    }));
    await this.cacheEmail.setCache( ko, JSON.stringify({
      username:userData.username,
      operation_id: opId,
      userWallet_id: uwId,
      value: 2,
      okCache: ok
    }));
    this.sendEmail.readyToVote(ctx.user.username, amount, userData, msg, url + '/emailVote/' + ok, url + '/emailVote/' + ko, type, username);
  }
  
  async checkValidEmail( ctx ) {
    const result = await this.cacheEmail.getCache( ctx.params.key );
    if (result) {
      const user = await this.db.User.findOne({
        where: {username: JSON.parse(result.data).username}
      });
      if (user) {
        const updated = await user.update({
          valid_email: true
        });
        if (updated) {
          this.cacheEmail.delFromCache(ctx.params.key);
          return ctx.redirect(process.env.FRONTEND_URL + '/validationpage');
        }
      }
    }
    ctx.redirect(process.env.FRONTEND_URL + '/errorvalidation');
  }

  evalVotes(oId, votes) {  
    const voteCount = votes.length;
    const affirmativeVoteCount = votes.filter(vote => vote.dataValues.value === 1).length;
    if (affirmativeVoteCount >= voteCount) return this.operationController.executeOperation(oId, votes);
    this.operationController.rejectOperation(oId, votes);  
  }
  
  async voteEmail( ctx ) {
    const key = ctx.params.key;
  
    let result = await this.cacheEmail.getCache( key );
    if (result) {
      result = JSON.parse(result.data);
  
      const vote = await this.db.Vote.findOne({
        where: {
          operation_id: result.operation_id,
          userwallet_id: result.userWallet_id,
        }
      });
      // eslint-disable-next-line
      if (!vote) return console.log({error: 'Vote no valid'});
      const updated = await vote.update({
        value: result.value
      });
      if (updated) {
        this.cacheEmail.delFromCache(key);
        if (result.value === 1) this.cacheEmail.delFromCache(result.koCache);
        else this.cacheEmail.delFromCache(result.okCache);
  
        const votes = await this.db.Vote.findAll({ where:
          {operation_id: result.operation_id},
        attributes: ['value','userwallet_id']
        });
  
        this.evalVotes(result.operation_id, votes);
  
        return ctx.redirect(process.env.FRONTEND_URL + '/thanksmessage');
      }
    }
    return ctx.redirect(process.env.FRONTEND_URL + '/errorvoting');
  }
}

module.exports = EmailController;