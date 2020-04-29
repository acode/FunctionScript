/**
* Populate options properly
* @param {string} database A database {!} db.databaseId {?} db.schema.databases.list $[].name $[].id
* @param {string} table A table {?} db.schema.databases.retrieve(databaseId=database) $[].name
* @returns {boolean} bool a Boolean?
*/
module.exports = async (database = 'hello', table = 'wat') => {
  return true;
};
