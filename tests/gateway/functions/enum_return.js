/**
 * Test Enum Returns
 * @param {?string} a
 * @param {?string} b
 * @returns {enum} either a or b
 *   ["a", 0]
 *   ["b", [1, 2, 3]]
 */
module.exports = async (a = null, b = null, context) => {
  if (a) {
    return a;
  }
  if (b) {
    return b;
  }
  return 'not correct';
};
