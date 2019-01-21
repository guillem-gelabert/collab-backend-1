'use strict';

const _ = require('lodash');

module.exports.filterProps = function (collection, properties) {
  return _.reduce(collection, (result, value, key) => {
    if (_.includes(properties, key)) result[key] = value;
    return result;
  }, {});
};

module.exports.validateAddress = function (address) {

  const isAlphanumeric = !RegExp(/[^A-Z0-9]/gi).test(address);
  if (!isAlphanumeric) throw new Error('Invalid address. Address is not alphanumeric: ', address);

  const charCheck = !address.split('').some(letter => {
    return ['I', 'l', 'O', '0'].includes(letter);
  });
  if (!charCheck) throw new Error('Invalid address. Address should not contain [\'I\', \'l\', \'O\', \'0\']: ', address);

  const lengthCheck = address.length === 34;
  if (!lengthCheck) throw new Error('Invalid address. Address should be 34 characters long: ', address);
};