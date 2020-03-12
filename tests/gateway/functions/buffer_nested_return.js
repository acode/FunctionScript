/**
* @returns {object} response
* @ {buffer} body
* @ {object} test
*/
module.exports = async () => {
  return {
    body: new Buffer('lol'),
    test: {
      deep: [
        0,
        new Buffer('wat'),
        2
      ]
    }
  };
};
