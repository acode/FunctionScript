/**
 * Test Invalid Enum Default
  * @param {enum} basic some basic types
 *   [num, 0]
 *   [double, "1"]
 *   [float, 1.2]
 *   [numstr, "123"]
 * @returns {any}
 */
module.exports = async (basic = 'not one of those') => {
  return basic;
};
