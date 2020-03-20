/**
* @returns {object} response
* @ {any} body
* @ {object} test
*/
module.exports = async () => {
  return {
    body: {
      _base64: Buffer.from('lol').toString('base64')
    },
    test: {
      deep: [
        0,
        {
          _base64: Buffer.from('wat').toString('base64')
        },
        2
      ]
    }
  };
};
