/**
* Test httpObject return
* @param {string} body Body value
* @param {number} statusCode Status code
* @param {any} headers Headers object
* @returns {object.http}
*/
module.exports = (body = null, statusCode = null, headers = null, callback) => {

  let returnValue = {body: body};
  if (statusCode !== null) {
    returnValue.statusCode = statusCode;
  }
  if (headers !== null) {
    returnValue.headers = headers;
  }

  return callback(null, returnValue);

};
