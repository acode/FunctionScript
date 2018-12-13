/**
* Test multi line descriptions
* This is a second line
* This is a third line
*
* This is a fourth line
*
* @param {number} alpha a number
* @returns {any}
*/
module.exports = (alpha = null, callback) => {
  return callback(null, 'hello world');
};
