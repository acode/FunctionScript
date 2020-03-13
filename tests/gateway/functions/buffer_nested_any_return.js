/**
* @returns {object} response
* @ {any} body
* @ {object} test
*/
module.exports = async () => {
  return {
    body: {
      _base64: new Buffer('lol').toString('base64')
    },
    test: {
      deep: [
        0,
        {
          _base64: new Buffer('wat').toString('base64')
        },
        2
      ]
    }
  };
};
