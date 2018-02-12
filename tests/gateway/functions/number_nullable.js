/**
* Test nullability with numbers
* @param {number} alpha a number
* @param {number} beta a number
* @returns {array}
*/
module.exports = (alpha = null, beta = null, callback) => {
  return callback(null, [alpha, beta]);
};
