'use strict';

const { KV_Store } = require('kv-store');
const fs = require('fs');

const conf = JSON.parse(fs.readFileSync('conf.json', 'utf8'));

const constants = {
  TABLE_AUTHENTICATION_NAME: process.env.TABLE_AUTHENTICATION_NAME,
};


module.exports.authenticate = (event, context, callback) => {
  console.log(event);
  const kv = new KV_Store(conf.host, conf.user, conf.pass, constants.TABLE_AUTHENTICATION_NAME);
  const result = event;

  kv.init()
    .then(() => kv.get(event.user))
    .then(res => kv.close().then(() => res))
    .then((res) => {
      console.log(res);
      console.log(event.pass);
      console.log(res === event.pass);
      if (res === event.pass) {
        // eslint-disable-next-line no-param-reassign
        result.authenticated = 'true';
      } else {
        result.authenticated = 'false';
        result.failureReason = 'Could not authenticate user';
      }
      callback(null, result)
    })
    .catch(err => callback(err))
};
