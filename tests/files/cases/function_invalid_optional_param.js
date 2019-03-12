/**
* Invalid function with an optional param
* name should have a default value
* @param {?string} name
* @returns {string}
*/
module.exports = (name, callback) => {

  return callback(null, name || 'hello');

};
