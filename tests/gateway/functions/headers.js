/**
* @returns {Buffer}
*/
module.exports = (callback) => {

  return callback(null, new Buffer('abcdef'), {'Content-Type': 'text/html'});

};
