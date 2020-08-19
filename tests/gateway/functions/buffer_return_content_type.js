/**
* @returns {buffer} mybuf
*/
module.exports = async () => {
  let buffer = Buffer.from('lol');
  buffer.contentType = 'image/png';
  return buffer;
};
