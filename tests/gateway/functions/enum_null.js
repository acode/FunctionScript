/**
 * Test Null Enum
 * @param {enum} thing
 *   ["a", 0]
 *   ["b", 1]
 * @returns {any}
 */
module.exports = async (thing = null) => {
  return thing;
};
