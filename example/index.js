const { Gateway, FunctionParser } = require('functionscript');

const ROOT = '.';

const FaaSGateway = new Gateway({ debug: true, root: ROOT });
const parser = new FunctionParser();

FaaSGateway.listen(8000);
FaaSGateway.define(parser.load(ROOT, 'functions'));

