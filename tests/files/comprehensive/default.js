/**
* Test default parameters
* @param {string} name A name
* @param {object} obj An object
* @returns {string}
*/
module.exports = (name = 'hello', obj = {result: {"a-string-key": 1, 1: 'one'}}, context, callback) => {
  return callback(null, 'Hello world');
};
