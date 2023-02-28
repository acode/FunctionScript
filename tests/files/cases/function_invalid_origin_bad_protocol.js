/**
* Function with an invalid origin
* @origin file://www.autocode.com
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'origin');

};
