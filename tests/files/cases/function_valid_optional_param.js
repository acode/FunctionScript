/**
* Valid function with an optional param
* @param {?string} name
* @returns {string}
*/
module.exports = (name = null, callback) => {

  return callback(null, name || 'hello');

};
