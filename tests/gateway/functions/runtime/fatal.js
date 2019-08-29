// Cause a fatal error
let x = {};
x.doAThing();

/**
* @returns {any}
*/
module.exports = (callback) => {

  callback(null, 'fatal error should occur due to code above');

};
