/**
* @returns {buffer}
*/
module.exports = (a = 2, b = 4, c = 6, callback) => {

  return callback(null, Buffer.from('hello'));

};
