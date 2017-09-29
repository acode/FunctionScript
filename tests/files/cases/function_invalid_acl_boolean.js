/**
* Function with an invalid ACL value
* @acl *
*   user_username faas_tester invalid
*   user_username faas_tester2 deny
*   user_username faas_tester3 deny
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'invalid acl entry');

};
