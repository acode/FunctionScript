/**
* Function with an invalid origin
* @origin *.autocode.com
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'origin');

};
