/**
* Valid function with a whitelist
* @acl
*   user_username faas_tester true
*   user_username faas_tester2 true
*   user_username faas_tester3 true
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'valid whitelist');

};
