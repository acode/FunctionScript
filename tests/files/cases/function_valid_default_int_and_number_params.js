/**
* My function
* @param {integer} a alpha
* @param {number} b beta
* @return {string}
*/
module.exports = function(a = 12, b = 342, context, callback) {
  // valid - this test is in response to issue #1 on github https://github.com/faaslang/faaslang/issues/1

  callback(null, `OK`);

};
