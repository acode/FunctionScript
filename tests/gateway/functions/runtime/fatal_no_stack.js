// Cause a fatal error
let error = new Error('stack removed');
delete error.stack;
throw error;

/**
* @returns {any}
*/
module.exports = (callback) => {

  callback(null, 'fatal error should occur due to code above');

};
