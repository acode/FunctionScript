/**
* Function with valid function definition order
* @background empty
* @charge 10
* @acl *
*   user_username faas_tester deny
*   user_username faas_tester2 deny
*   user_username faas_tester3 deny
* @param {string} test
* @returns {string}
*/
module.exports = (test, callback) => {

  return callback(null, 'function with valid definition order');

};
