/**
* @param {array} a
* @ {?number} someNumber
* @param {object} b
* @ {?number} lol
* @ {?string} wat
* @returns {object}
*/
module.exports = async (a = [], b = {}) => {

  return {
    a: a,
    b: b
  };

};
