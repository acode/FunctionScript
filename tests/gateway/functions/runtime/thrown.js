/**
* @returns {any}
*/
module.exports = (callback) => {

  throw new Error('crap');
  callback(new Error('error'));

};
