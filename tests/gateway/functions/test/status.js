/**
* @returns {Buffer}
*/
module.exports = (callback) => {

  callback(null, Buffer.from('not found'), {status: 404});

};
