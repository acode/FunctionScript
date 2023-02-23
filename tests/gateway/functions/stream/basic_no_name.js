/**
* Valid function for streaming
* @param {string} alpha Some value
* @streams {boolean}
*/
module.exports = async (alpha, context) => {

  context.stream('', true);

  return true;

};
