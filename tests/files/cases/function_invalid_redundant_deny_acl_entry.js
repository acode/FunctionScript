/**
* Invalid function due to redundant deny ACL entry
* @acl
*   user_username faas_tester deny
*   user_username faas_tester2 deny
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'invalid ACL due to redundant deny entry');

};
