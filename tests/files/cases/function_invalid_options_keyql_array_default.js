/**
* Invalid Options Array
* @param {array} query {?} ["name", "age"]
* @ {object.keyql.query}
* @returns {boolean}
*/
module.exports = async (query = [{"last_name__is": "john"}]) => {
  return true;
};
