/**
* My function
* @returns {number}
*/
module.exports = (a = 1, b = 2, c = 3, callback) => {

  if (c === 100) {
    return callback(null, 'hello value');
  }

  return callback(null, a + b + c);

};
