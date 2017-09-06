/**
* Function with an invalid ACL entry
* @acl
*   faas_tester true
*   user_username
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'invalid acl entry');

};
