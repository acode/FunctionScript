/**
* Valid function for streaming
* @param {string} alpha Some value
* @streams {boolean} hello Some value
*/
module.exports = async (alpha, context) => {

  context.stream('hello', 'what');

  return true;

};
