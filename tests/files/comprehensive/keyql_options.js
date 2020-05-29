/**
* Valid KeyQL Query with Options
* @param {object.keyql.query} query Query API based on these parameters {?} ["status", "hello", "goodbye"]
* @param {object.keyql.query} query2 Query API based on these parameters {?} db.schema.database.fields $.fields[].name $.fields[].id
* @param {array} keyqlquery
* @ {object.keyql.query} queryobj Query API based on these parameters {?} ["status", "hello", "goodbye"]
* @returns {string}
*/
module.exports = async (query, query2, keyqlquery) => {
  return 'hello';
};
