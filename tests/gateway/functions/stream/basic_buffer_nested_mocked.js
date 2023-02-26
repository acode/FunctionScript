/**
* Valid function for streaming
* @param {string} alpha Some value
* @stream {object} hello
* @ {buffer} mybuff
*/
module.exports = async (alpha, context) => {

  context.stream('hello', {mybuff: {_base64: Buffer.from('123').toString('base64')}});

  return true;

};
