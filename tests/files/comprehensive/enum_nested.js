/**
* Test Nested Enum
* @param {object} obj
* @ {string} selector The selector to query
* @ {enum} operator Which data to retrieve: can be "text", "html" or "attr"
*     ["text", "text"]
*     ["html", "html"]
*     ["attr", "attr"]
* @ {?string} attr If method is "attr", which attribute to retrieve
* @param {array} arr
* @ {object} obj
* @   {string} selector The selector to query
* @   {enum} operator Which data to retrieve: can be "text", "html" or "attr"
*       ["text", "text"]
*       ["html", "html"]
*       ["attr", "attr"]
* @   {?string} attr If method is "attr", which attribute to retrieve
* @returns {boolean} myBool A boolean value
*/
module.exports = async (obj, arr, context) => {
  return obj.operator;
};
