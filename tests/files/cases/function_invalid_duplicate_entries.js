/**
* Invalid function due to duplicate ACL entries
* @acl *
*   user_username faas_tester deny
*   user_username faas_tester2 deny
*   user_username faas_tester2 deny
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'invalid ACL due to duplicate entries');

};
