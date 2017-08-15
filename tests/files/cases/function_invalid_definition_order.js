/**
* Valid function with a blacklist
* @param {string} test
* @acl *
*   user_username faas_tester false
*   user_username faas_tester2 false
*   user_username faas_tester3 false
* @returns {string}
*/
module.exports = (test, callback) => {

  return callback(null, 'valid blacklist');

};
