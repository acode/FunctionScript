/**
 * Test mismatch
 * @returns {object} myObject
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
