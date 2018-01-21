/**
* @returns {any}
*/
module.exports = (callback) => {

  new Promise((resolve, reject) => {
    reject(new Error('crap'));
  }).then(result => {
    return callback(null, result);
  });

};
