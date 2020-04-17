/**
* Invalid Options
* @param {string} database {?} db $[].name $[].id
* @param {string} table {?} db.schema.databases.retrieve(databaseId=database) $[].name
* @returns {boolean}
*/
module.exports = async (database = 'hello', table = 'wat') => {
  return true;
};
