/**
* @returns {Buffer}
*/
module.exports = (callback) => {

  return callback(null, Buffer.from('abcdef'), {'Content-Type': 'text/html'});

};
