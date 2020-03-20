/**
* @returns {buffer} response
*/
module.exports = async () => {
  return {_base64: Buffer.from('lol').toString('base64')};
};
