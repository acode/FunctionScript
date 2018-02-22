/**
* @returns {any}
*/
module.exports = (context, callback) => {

  return callback(null, context.http.body);

};
