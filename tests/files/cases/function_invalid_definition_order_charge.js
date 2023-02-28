/**
* Function with invalid function definition order due to charge
* @background empty
* @acl *
*   user_username faas_tester deny
*   user_username faas_tester2 deny
*   user_username faas_tester3 deny
* @param {string} test
* @charge 10
* @returns {string}
*/
module.exports = (test, callback) => {

  return callback(null, 'function with invalid definition order due to charge');

};
