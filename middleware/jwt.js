var jwt = require('jsonwebtoken');
require('dotenv').config();

const jWToken = async (ctx, next) => {
  ctx.jwt = {};
  ctx.jwt['modified'] = false;
  if (!ctx.request.headers.authorization && ctx.url !== '/register') return await next();
  if ( ctx.request.headers.authorization ){
    const auth = ctx.request.headers.authorization.split(' ');
    if (auth[0] !== 'Bearer') {
      await next();
    } else {
      let decoded = jwt.verify(auth[1], process.env.JWT_SECRET);
      ctx.user = {
        username: decoded.username
      };
      await next();
    }
  } else await next();


  if (ctx.jwt.modified) {
    console.log('jwt secret', process.env.JWT_SECRET);
    const token = jwt.sign(ctx.user, process.env.JWT_SECRET, {
      expiresIn: 86400
    });
    console.log('the token', token);
    console.log('the ctx body', ctx.body);
    
    // ctx.set('x-token',token);
    if (!ctx.body) {
      ctx.body = {'jwt':token};
    } else {
      Object.assign(ctx.body, {'jwt':token});
      console.log('object. assign', ctx.body);
      
    }
  }
};

module.exports = jWToken;