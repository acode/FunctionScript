/**
* Valid function for streaming
* @param {string} alpha Some value
* @streams {buffer} hello Some value
*/
module.exports = async (alpha, context) => {

  context.stream('hello', {_base64: Buffer.from('123').toString('base64')});

  return true;

};
