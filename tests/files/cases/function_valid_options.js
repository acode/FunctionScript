/**
* Valid Options
* @param {string} database {?} db.schema.databases.list $[].name $[].id
* @param {string} table {?} db.schema.databases.retrieve(databaseId=database) $[].name
* @returns {boolean}
*/
module.exports = async (database = 'hello', table = 'wat') => {
  return true;
};
