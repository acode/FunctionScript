/**
 * Test mismatch
 * @returns {object}
 * @ {object} user
 * @   {array} names
 * @     {string} name
 */
module.exports = async () => {
  return {
    user: {
      names: ['keith', 2]
    }
  };
};
