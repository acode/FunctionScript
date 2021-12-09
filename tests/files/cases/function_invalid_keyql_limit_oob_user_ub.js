/**
* Invalid KeyQL Limit
* @param {object.keyql.limit} limit Some limit {:} [2, 20]
* @returns {string}
*/
module.exports = async (limit = {count: 21, offset: 0}) => {
  return 'hello';
};
