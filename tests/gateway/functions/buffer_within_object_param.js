/**
* @param {object} objectParam
* @ {buffer} bufferVal
*/
module.exports = async (objectParam) => {
  if (!Buffer.isBuffer(objectParam.bufferVal)) {
    throw new Error('The parsed value of the object parameter\'s "bufferVal" key is not a buffer');
  }
  return 'ok';
};
