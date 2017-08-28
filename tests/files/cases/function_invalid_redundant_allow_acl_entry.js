/**
* Invalid function due to redundant allow ACL entry
* @acl *
*   user_username faas_tester allow
*   user_username faas_tester2 allow
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'invalid ACL due to redundant allow entry');

};
