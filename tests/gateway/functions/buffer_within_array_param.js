/**
* @param {array} arrayParam
* @ {buffer} bufferItem
*/
module.exports = async (arrayParam) => {
  if (!arrayParam.length) {
    throw new Error('No array items provided');
  }
  if (!Buffer.isBuffer(arrayParam[0])) {
    throw new Error('The parsed value of the array parameter\'s item is not a buffer');
  }
  return 'ok';
};
