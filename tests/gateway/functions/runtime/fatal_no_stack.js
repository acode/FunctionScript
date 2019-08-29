let error = new Error('stack removed');
delete error.stack;
throw error;

/**
* @returns {any}
*/
module.exports = (callback) => {

  callback(new Error('error'));

};
