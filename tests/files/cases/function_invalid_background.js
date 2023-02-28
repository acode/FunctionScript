/**
* Function with an invalid background
* @background hello
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'invalid acl entry');

};
