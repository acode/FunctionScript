/**
* Test rejection of invalid header values
* @param {string} contentType A content type
* @returns {object.http}
*/
module.exports = (contentType = 'text/html', callback) => {

  return callback(null, {
    body: 'hello',
    headers: {
      'Null-Value': null,
      'Undefined-Value': undefined,
      'Object-Value': {
        'a': 'b'
      },
      'Boolean-Value': false,
      'Empty-String-Value': ''
    }
  });

};
