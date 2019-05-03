/**
 * Test Enum Returns
 * @param {?string} a
 * @param {?string} b
 * @returns {enum} either a or b
 *   ["a", 0]
 *   ["b", 1]
 */
module.exports = async (a = null, b = null, context) => {
  return a || b;
};
