/**
* Test type rejection
* @param {integer} alpha An Integer
* @returns {integer}
*/
module.exports = (alpha = 100, context, callback) => {
  return callback(null, alpha);
};
