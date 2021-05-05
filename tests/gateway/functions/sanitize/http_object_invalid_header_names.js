/**
* Test rejection of invalid header names
* @param {string} contentType A content type
* @returns {object.http}
*/
module.exports = (contentType = 'text/html', callback) => {

  return callback(null, {
    body: 'hello',
    headers: {
      'Content-Type ': contentType,
      'X Authorization Key': 'somevalue',
      ' AnotherHeader': 'somevalue',
      'WeirdName!@#$%^&*()œ∑´®†¥¨ˆøπåß∂ƒ©˙∆˚¬≈ç√∫˜µ≤:|\{}🔥🔥🔥': 'test',
      'MultilineName\n': 'test',
      'Good-Header-Name': 'good value'
    }
  });

};
