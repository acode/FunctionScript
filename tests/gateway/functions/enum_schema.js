/**
 * @param {string} before a param
 * @param {object} valueRange The data to be inserted
 * @ {string} range
 * @ {enum} majorDimension
 *     ["ROWS", "ROWS"]
 *     ["COLUMNS", "COLUMNS"]
 * @ {array} values An array of arrays, the outer array representing all the data and each inner array representing a major dimension. Each item in the inner array corresponds with one cell
 * @param {string} after a param
 * @returns {any}
 */
module.exports = async (before, valueRange, after, context) => {
  return valueRange;
};
