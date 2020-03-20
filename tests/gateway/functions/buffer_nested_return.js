/**
* @returns {object} response
* @ {buffer} body
* @ {object} test
*/
module.exports = async () => {
  return {
    body: Buffer.from('lol'),
    test: {
      deep: [
        0,
        Buffer.from('wat'),
        2
      ]
    }
  };
};
