const babelParser = require('@babel/parser');

const RESERVED_NAMES = [
  '_stream',
  '_bg',
  'context'
];

function validateParameterName(param) {
  try {
    let token = babelParser.parseExpression(param);
    if (
      !token || token.type !== 'Identifier' || token.name === 'let' ||
      RESERVED_NAMES.indexOf(token.name) !== -1
    ) {
      return false;
    }
  } catch (e) {
    return false;
  }
  return true;
}

module.exports = validateParameterName;
