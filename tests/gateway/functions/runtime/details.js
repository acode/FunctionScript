/**
* @returns {any}
*/
module.exports = (callback) => {

  let error = new Error('error');
  error.details = {objects: 'supported'};
  callback(error);

};
