/**
* Function with an invalid ACL boolean value
* @acl *
*   user_username faas_tester invalid
*   user_username faas_tester2 false
*   user_username faas_tester3 false
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'valid blacklist');

};
