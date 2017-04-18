/**
* @returns {Buffer}
*/
module.exports = (callback) => {

  callback(null, new Buffer('not found'), {status: 404});

};
