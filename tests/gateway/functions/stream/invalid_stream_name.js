/**
* Valid function for streaming
* @param {string} alpha Some value
* @stream {boolean} hello Some value
*/
module.exports = async (alpha, context) => {

  context.stream('hello2', 'what');

  return true;

};
