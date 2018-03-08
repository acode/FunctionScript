/**
* Test httpObject return
* @param {string} contentType A content type
* @returns {object.http}
*/
module.exports = (contentType = 'text/html', callback) => {

  return callback(null, {
    body: 'hello',
    headers: {
      'Content-Type': contentType
    }
  });

};
