/**
* Invalid Options Array
* @param {object.keyql.query} query {?} ["name", "age"]
* @returns {boolean}
*/
module.exports = async (query = {"last_name__is": "john"}) => {
  return true;
};
