/**
* Valid function for streaming
* @param {string} alpha Some value
* @stream {boolean}
*/
module.exports = async (alpha, context) => {

  context.stream('', true);

  return true;

};
