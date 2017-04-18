const FunctionParser = require('../index.js').FunctionParser;
let definition = new FunctionParser().load('./tests/files', 'comprehensive');
console.log(JSON.stringify(definition, null, 2));
