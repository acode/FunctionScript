/**
* Valid function with a whitelist
* @acl
*   user_username faas_tester allow
*   user_username faas_tester2 allow
*   user_username faas_tester3 allow
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'valid whitelist');

};
