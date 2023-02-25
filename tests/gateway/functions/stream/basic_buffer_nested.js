/**
* Valid function for streaming
* @param {string} alpha Some value
* @streams {any} hello
*/
module.exports = async (alpha, context) => {

  context.stream('hello', {mybuff: Buffer.from('123')});

  return true;

};
