/**
* Invalid Options Array
* @param {array} query {?} ["name", "age"]
* @ {object.keyql.query}
* @returns {boolean}
*/
module.exports = async (query = [{"name__is": "john"}]) => {
  return true;
};
