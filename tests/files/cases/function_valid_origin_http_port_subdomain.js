/**
* Function with an valid origin
* @origin http://x.y.z.localhost:8000
* @returns {string}
*/
module.exports = (callback) => {

  return callback(null, 'origin');

};
