/**
* Invalid function due to invalid function definition order
* @param {string} test
* @acl *
*   user_username faas_tester deny
*   user_username faas_tester2 deny
*   user_username faas_tester3 deny
* @returns {string}
*/
module.exports = (test, callback) => {

  return callback(null, 'invalid function due to comment definition order');

};
