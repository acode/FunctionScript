/**
* @returns {buffer} response
*/
module.exports = async () => {
  return {_base64: new Buffer('lol').toString('base64')};
};
