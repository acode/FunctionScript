/**
* Test Optional Params
* @param {?string} name
* @returns {string}
*/
module.exports = async (name = null) => {

  return name || 'hello';

};
