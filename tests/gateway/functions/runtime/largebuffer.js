/**
* @param {buffer} file
* @returns {any}
*/
module.exports = (file, callback) => {

  callback(null, file.length);

};
