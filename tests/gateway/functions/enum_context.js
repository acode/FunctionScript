/**
 * Test Enum
 * @param {enum} thingA
 *   ["a", 0]
 *   ["b", {"c": 1, "d": [1, 2, 3]}]
 *   ["c", "4"]
 *   ["d", 5.4321]
 * @returns {object}
 */
module.exports = async (thingA, context) => {
  return context.function.enums.thingA;
};
