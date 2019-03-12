/**
* Valid function with a named return value
* @param {string} paramName And a param description
* @returns {string} returnName And a return description
*/
module.exports = (paramName, callback) => {

  return callback(null, paramName);

};
