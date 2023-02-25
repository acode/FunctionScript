/**
* Valid function for streaming
* @param {string} alpha Some value
* @streams {buffer} hello Some value
*/
module.exports = async (alpha, context) => {

  context.stream('hello', Buffer.from('123'));

  return true;

};
