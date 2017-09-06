/**
* Valid function with a blacklist
* @acl *
*   user_username faas_tester deny
*   user_username faas_tester2 deny
*   user_username faas_tester3 deny
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'valid blacklist');

};
