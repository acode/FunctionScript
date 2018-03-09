/**
* Test httpObject return
* @returns {object.http}
*/
module.exports = (callback) => {

  return callback(null, {
    body: {_base64: 'Zml4IGZvciBzdGV2ZW4='}
  });

};
