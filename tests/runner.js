const chai = require('chai');
const expect = chai.expect;

const fs = require('fs');
const path = require('path');
const CASE_PATH = './tests/files/cases';
const cases = fs.readdirSync(CASE_PATH).map(filename => {
  if (!filename.endsWith('.js')) {
    throw new Error(`Invalid case ${filename} in ./tests/files/cases`);
  }
  let name = filename.substr(0, filename.length - 3);
  let names = name.split('_').map(n => n[0].toUpperCase() + n.substr(1));
  return {
    name: [names[0], `(${names[1]})`].concat(names.slice(2)).join(' '),
    valid: names[1] === 'Valid',
    pathname: filename,
    buffer: fs.readFileSync(path.join(CASE_PATH, filename))
  }
});


describe('LibDoc', () => {

  const FunctionParser = require('../index.js').FunctionParser;
  const parser = new FunctionParser();
  const NodeJsFunctionParser = new FunctionParser.parsers['nodejs']();
  const types = require('../index.js').types;

  describe('Function Validation', () => {

    cases.forEach(functionCase => {

      it(`Should check ${functionCase.name}`, () => {

        let err;

        try {
          parser.parseDefinition(functionCase.pathname, functionCase.buffer);
        } catch (e) {
          err = e;
        }

        functionCase.valid ?
          expect(err).to.not.exist :
          expect(err).to.exist;

      });

    });

  });

  describe('Comprehensive Test', () => {

    let definitions = parser.load('./tests/files/comprehensive');
    let ignoredDefinitions = parser.load('./tests/files/ignore', null, ['ignoreme.js']);

    it('Should read all functions correctly', () => {

      expect(Object.keys(definitions).length).to.equal(25);
      expect(definitions).to.haveOwnProperty('');
      expect(definitions).to.haveOwnProperty('test');
      expect(definitions).to.haveOwnProperty('returns');
      expect(definitions).to.haveOwnProperty('default');
      expect(definitions).to.haveOwnProperty('multiline_description');
      expect(definitions).to.haveOwnProperty('dir/test');
      expect(definitions).to.haveOwnProperty('dir/sub');
      expect(definitions).to.haveOwnProperty('dir/sub/test');
      expect(definitions).to.haveOwnProperty('schema/basic');
      expect(definitions).to.haveOwnProperty('schema/optional');
      expect(definitions).to.haveOwnProperty('schema/nested');
      expect(definitions).to.haveOwnProperty('schema/array');
      expect(definitions).to.haveOwnProperty('enum');
      expect(definitions).to.haveOwnProperty('enum_return');
      expect(definitions).to.haveOwnProperty('enum_nested');
      expect(definitions).to.haveOwnProperty('enum_nested_optional');
      expect(definitions).to.haveOwnProperty('options');
      expect(definitions).to.haveOwnProperty('keyql_options');
      expect(definitions).to.haveOwnProperty('alternate_schemas');
      expect(definitions).to.haveOwnProperty('inline');

    });

    it('Should read all functions correctly with ignore parameter set', () => {

      expect(Object.keys(ignoredDefinitions).length).to.equal(1);
      expect(ignoredDefinitions).to.haveOwnProperty('');

    });

    it('Should have correct filenames', () => {

      expect(definitions[''].pathname).to.equal('__main__.js');
      expect(definitions['test'].pathname).to.equal('test.js');
      expect(definitions['returns'].pathname).to.equal('returns.js');
      expect(definitions['default'].pathname).to.equal('default.js');
      expect(definitions['multiline_description'].pathname).to.equal('multiline_description.js');
      expect(definitions['dir/test'].pathname).to.equal('dir/test.js');
      expect(definitions['dir/sub'].pathname).to.equal('dir/sub/__main__.js');
      expect(definitions['dir/sub/test'].pathname).to.equal('dir/sub/test.js');
      expect(definitions['schema/basic'].pathname).to.equal('schema/basic.js');
      expect(definitions['schema/optional'].pathname).to.equal('schema/optional.js');
      expect(definitions['schema/nested'].pathname).to.equal('schema/nested.js');
      expect(definitions['schema/array'].pathname).to.equal('schema/array.js');
      expect(definitions['enum'].pathname).to.equal('enum.js');
      expect(definitions['enum_return'].pathname).to.equal('enum_return.js');
      expect(definitions['enum_nested'].pathname).to.equal('enum_nested.js');
      expect(definitions['enum_nested_optional'].pathname).to.equal('enum_nested_optional.js');
      expect(definitions['options'].pathname).to.equal('options.js');
      expect(definitions['inline'].pathname).to.equal('inline.js');

    });

    it('Should have correct descriptions', () => {

      expect(definitions[''].description).to.equal('');
      expect(definitions['test'].description).to.equal('Test function');
      expect(definitions['returns'].description).to.equal('');
      expect(definitions['default'].description).to.equal('Test default parameters');
      expect(definitions['multiline_description'].description).to.equal('Test multi line descriptions\nThis is a second line\nThis is a third line\n\nThis is a fourth line\n');
      expect(definitions['dir/test'].description).to.equal('');
      expect(definitions['dir/sub'].description).to.equal('Test function');
      expect(definitions['dir/sub/test'].description).to.equal('');
      expect(definitions['schema/basic'].description).to.equal('Test Schema Input');
      expect(definitions['schema/optional'].description).to.equal('Test Optional Schema Input');
      expect(definitions['schema/nested'].description).to.equal('Test Nested Schema Input');
      expect(definitions['schema/array'].description).to.equal('Test Array Schema Input');
      expect(definitions['enum'].description).to.equal('Test Enum');
      expect(definitions['enum_return'].description).to.equal('Test Enum Returns');
      expect(definitions['enum_nested'].description).to.equal('Test Nested Enum');
      expect(definitions['enum_nested_optional'].description).to.equal('Test Optional Nested Enum');
      expect(definitions['options'].description).to.equal('Populate options properly');
      expect(definitions['inline'].description).to.equal('');

    });

    it('Should have correct context', () => {

      expect(definitions[''].context).to.equal(null);
      expect(definitions['test'].context).to.exist;
      expect(definitions['returns'].context).to.equal(null);
      expect(definitions['default'].context).to.exist;
      expect(definitions['multiline_description'].context).to.equal(null);
      expect(definitions['dir/test'].context).to.exist;
      expect(definitions['dir/sub'].context).to.equal(null);
      expect(definitions['dir/sub/test'].context).to.exist;
      expect(definitions['schema/basic'].context).to.equal(null);
      expect(definitions['schema/optional'].context).to.equal(null);
      expect(definitions['schema/nested'].context).to.equal(null);
      expect(definitions['schema/array'].context).to.equal(null);
      expect(definitions['enum'].context).to.equal(null);
      expect(definitions['enum_return'].context).to.exist;
      expect(definitions['enum_nested'].context).to.exist;
      expect(definitions['enum_nested_optional'].context).to.exist;
      expect(definitions['options'].context).to.equal(null);
      expect(definitions['inline'].context).to.exist;


    });

    it('Should have correct returns descriptions', () => {

      expect(definitions[''].returns.description).to.equal('');
      expect(definitions['test'].returns.description).to.equal('');
      expect(definitions['returns'].returns.description).to.equal('hello');
      expect(definitions['default'].returns.description).to.equal('');
      expect(definitions['dir/test'].returns.description).to.equal('');
      expect(definitions['dir/sub'].returns.description).to.equal('A return description!');
      expect(definitions['dir/sub/test'].returns.description).to.equal('');
      expect(definitions['schema/basic'].returns.description).to.equal('');
      expect(definitions['schema/optional'].returns.description).to.equal('');
      expect(definitions['schema/nested'].returns.description).to.equal('');
      expect(definitions['schema/array'].returns.description).to.equal('');
      expect(definitions['enum'].returns.description).to.equal('');
      expect(definitions['enum_return'].returns.description).to.equal('a or b');
      expect(definitions['enum_nested'].returns.description).to.equal('A boolean value');
      expect(definitions['enum_nested_optional'].returns.description).to.equal('A boolean value');
      expect(definitions['options'].returns.description).to.equal('a Boolean?');
      expect(definitions['inline'].returns.description).to.equal('');

    });

    it('Should have correct returns types', () => {

      expect(definitions[''].returns.type).to.equal('any');
      expect(definitions['test'].returns.type).to.equal('boolean');
      expect(definitions['returns'].returns.type).to.equal('number');
      expect(definitions['default'].returns.type).to.equal('string');
      expect(definitions['dir/test'].returns.type).to.equal('any');
      expect(definitions['dir/sub'].returns.type).to.equal('boolean');
      expect(definitions['dir/sub/test'].returns.type).to.equal('any');
      expect(definitions['schema/basic'].returns.type).to.equal('string');
      expect(definitions['schema/optional'].returns.type).to.equal('string');
      expect(definitions['schema/nested'].returns.type).to.equal('string');
      expect(definitions['schema/array'].returns.type).to.equal('string');
      expect(definitions['enum'].returns.type).to.equal('any');
      expect(definitions['enum_return'].returns.type).to.equal('enum');
      expect(definitions['enum_nested'].returns.type).to.equal('boolean');
      expect(definitions['enum_nested'].returns.type).to.equal('boolean');
      expect(definitions['options'].returns.type).to.equal('boolean');
      expect(definitions['inline'].returns.type).to.equal('any');

    });

    it('Should have correct charge value', () => {

      expect(definitions[''].charge).to.equal(1);
      expect(definitions['test'].charge).to.equal(0);
      expect(definitions['returns'].charge).to.equal(1);
      expect(definitions['default'].charge).to.equal(1);
      expect(definitions['multiline_description'].charge).to.equal(1);
      expect(definitions['dir/test'].charge).to.equal(1);
      expect(definitions['dir/sub'].charge).to.equal(19);
      expect(definitions['dir/sub/test'].charge).to.equal(1);
      expect(definitions['schema/basic'].charge).to.equal(1);
      expect(definitions['schema/optional'].charge).to.equal(1);
      expect(definitions['schema/nested'].charge).to.equal(1);
      expect(definitions['schema/array'].charge).to.equal(1);
      expect(definitions['enum'].charge).to.equal(1);
      expect(definitions['enum_return'].charge).to.equal(1);
      expect(definitions['enum_nested'].charge).to.equal(1);
      expect(definitions['enum_nested_optional'].charge).to.equal(1);
      expect(definitions['options'].charge).to.equal(1);
      expect(definitions['inline'].charge).to.equal(1);

    });

    it('Should have correct keys', () => {

      expect(definitions[''].keys).to.be.an('Array');
      expect(definitions[''].keys).to.have.length(0);
      expect(definitions['test'].keys).to.be.an('Array');
      expect(definitions['test'].keys).to.have.length(0);
      expect(definitions['returns'].keys).to.be.an('Array');
      expect(definitions['returns'].keys).to.have.length(0);
      expect(definitions['default'].keys).to.be.an('Array');
      expect(definitions['default'].keys).to.have.length(0);
      expect(definitions['multiline_description'].keys).to.be.an('Array');
      expect(definitions['multiline_description'].keys).to.have.length(0);
      expect(definitions['dir/test'].keys).to.be.an('Array');
      expect(definitions['dir/test'].keys).to.have.length(0);
      expect(definitions['dir/sub'].keys).to.be.an('Array');
      expect(definitions['dir/sub'].keys).to.have.length(2);
      expect(definitions['dir/sub'].keys[0]).to.equal('TEST_KEY');
      expect(definitions['dir/sub'].keys[1]).to.equal('TEST_KEY2');
      expect(definitions['dir/sub/test'].keys).to.be.an('Array');
      expect(definitions['dir/sub/test'].keys).to.have.length(0);
      expect(definitions['schema/basic'].keys).to.be.an('Array');
      expect(definitions['schema/basic'].keys).to.have.length(0);
      expect(definitions['schema/optional'].keys).to.be.an('Array');
      expect(definitions['schema/optional'].keys).to.have.length(0);
      expect(definitions['schema/nested'].keys).to.be.an('Array');
      expect(definitions['schema/nested'].keys).to.have.length(0);
      expect(definitions['schema/array'].keys).to.be.an('Array');
      expect(definitions['schema/array'].keys).to.have.length(0);
      expect(definitions['enum'].keys).to.be.an('Array');
      expect(definitions['enum'].keys).to.have.length(0);
      expect(definitions['enum_return'].keys).to.be.an('Array');
      expect(definitions['enum_return'].keys).to.have.length(0);
      expect(definitions['enum_nested'].keys).to.be.an('Array');
      expect(definitions['enum_nested'].keys).to.have.length(0);
      expect(definitions['enum_nested_optional'].keys).to.have.an('Array');
      expect(definitions['enum_nested_optional'].keys).to.have.length(0);
      expect(definitions['options'].keys).to.be.an('Array');
      expect(definitions['options'].keys).to.have.length(0);
      expect(definitions['inline'].keys).to.have.length(0);

    });

    it('Should read "" (default) parameters', () => {

      let params = definitions[''].params;
      expect(params.length).to.equal(0);

    });

    it('Should read "test" parameters', () => {

      let params = definitions['test'].params;
      expect(params.length).to.equal(1);
      expect(params[0].name).to.equal('a');
      expect(params[0].type).to.equal('boolean');
      expect(params[0].description).to.equal('alpha');

    });

    it('Should read "default" parameters', () => {

      let params = definitions['default'].params;
      expect(params.length).to.equal(2);
      expect(params[0].name).to.equal('name');
      expect(params[0].type).to.equal('string');
      expect(params[0].description).to.equal('A name');
      expect(params[0].defaultValue).to.equal('hello');
      expect(params[1].name).to.equal('obj');
      expect(params[1].type).to.equal('object');
      expect(params[1].description).to.equal('An object');
      expect(params[1].defaultValue).to.exist;
      expect(params[1].defaultValue).to.haveOwnProperty('result');
      expect(params[1].defaultValue.result).to.haveOwnProperty('a-string-key');
      expect(params[1].defaultValue.result['a-string-key']).to.equal(1);
      expect(params[1].defaultValue.result[1]).to.equal('one');

    });

    it('Should read "dir/test" parameters', () => {

      let params = definitions['dir/test'].params;
      expect(params.length).to.equal(6);
      expect(params[0].name).to.equal('a');
      expect(params[0].type).to.equal('boolean');
      expect(params[0].description).to.equal('');
      expect(params[1].name).to.equal('b');
      expect(params[1].type).to.equal('string');
      expect(params[1].description).to.equal('');
      expect(params[2].name).to.equal('c');
      expect(params[2].type).to.equal('number');
      expect(params[2].description).to.equal('');
      expect(params[3].name).to.equal('d');
      expect(params[3].type).to.equal('any');
      expect(params[3].description).to.equal('');
      expect(params[4].name).to.equal('e');
      expect(params[4].type).to.equal('array');
      expect(params[4].description).to.equal('');
      expect(params[5].name).to.equal('f');
      expect(params[5].type).to.equal('object');
      expect(params[5].description).to.equal('');

    });

    it('Should read "dir/test" default values', () => {

      let params = definitions['dir/test'].params;
      expect(params.length).to.equal(6);
      expect(params[0].defaultValue).to.equal(true);
      expect(params[1].defaultValue).to.equal('false');
      expect(params[2].defaultValue).to.equal(1);
      expect(params[3].defaultValue).to.equal(null);
      expect(params[4].defaultValue).to.be.an('array');
      expect(params[4].defaultValue).to.deep.equal([]);
      expect(params[5].defaultValue).to.be.an('object');
      expect(params[5].defaultValue).to.deep.equal({});

    });

    it('Should read "dir/sub" parameters', () => {

      let params = definitions['dir/sub'].params;
      expect(params.length).to.equal(6);
      expect(params[0].name).to.equal('a');
      expect(params[0].type).to.equal('boolean');
      expect(params[0].description).to.equal('alpha');
      expect(params[1].name).to.equal('b');
      expect(params[1].type).to.equal('string');
      expect(params[1].description).to.equal('beta');
      expect(params[2].name).to.equal('c');
      expect(params[2].type).to.equal('number');
      expect(params[2].description).to.equal('gamma');
      expect(params[3].name).to.equal('d');
      expect(params[3].type).to.equal('any');
      expect(params[3].description).to.equal('delta');
      expect(params[4].name).to.equal('e');
      expect(params[4].type).to.equal('array');
      expect(params[4].description).to.equal('epsilon');
      expect(params[5].name).to.equal('f');
      expect(params[5].type).to.equal('object');
      expect(params[5].description).to.equal('zeta');

    });

    it('Should read "dir/sub" default values', () => {

      let params = definitions['dir/sub'].params;
      expect(params.length).to.equal(6);
      expect(params[0].defaultValue).to.equal(true);
      expect(params[1].defaultValue).to.equal('false');
      expect(params[2].defaultValue).to.equal(1);
      expect(params[3].defaultValue).to.equal(null);
      expect(params[4].defaultValue).to.be.an('array');
      expect(params[4].defaultValue).to.deep.equal([1, 2, 3, {four: 'five'}]);
      expect(params[5].defaultValue).to.be.an('object');
      expect(params[5].defaultValue).to.deep.equal({one: 'two', three: [4, 5]});

    });

    it('Should read "dir/sub/test" parameters', () => {

      let params = definitions['dir/sub/test'].params;
      expect(params.length).to.equal(0);

    });

    it('Should read "schema/basic" parameters', () => {

      let params = definitions['schema/basic'].params;
      expect(params.length).to.equal(3);
      expect(params[0].name).to.equal('before');
      expect(params[0].type).to.equal('string');
      expect(params[0].description).to.equal('');
      expect(params[2].name).to.equal('after');
      expect(params[2].type).to.equal('string');
      expect(params[2].description).to.equal('');
      expect(params[1].name).to.equal('obj');
      expect(params[1].type).to.equal('object');
      expect(params[1].description).to.equal('');
      expect(params[1].schema).to.exist;
      expect(params[1].schema[0].name).to.equal('name');
      expect(params[1].schema[0].type).to.equal('string');
      expect(params[1].schema[1].name).to.equal('enabled');
      expect(params[1].schema[1].type).to.equal('boolean');
      expect(params[1].schema[2].name).to.equal('data');
      expect(params[1].schema[2].type).to.equal('object');
      expect(params[1].schema[2].schema[0].name).to.equal('a');
      expect(params[1].schema[2].schema[0].type).to.equal('string');
      expect(params[1].schema[2].schema[1].name).to.equal('b');
      expect(params[1].schema[2].schema[1].type).to.equal('string');
      expect(params[1].schema[3].name).to.equal('timestamp');
      expect(params[1].schema[3].type).to.equal('number');

    });

    it('Should read "schema/optional" parameters', () => {

      let params = definitions['schema/optional'].params;
      expect(params.length).to.equal(3);

      expect(params[0].name).to.equal('before');
      expect(params[0].defaultValue).to.equal(null);
      expect(params[0].type).to.equal('string');
      expect(params[0].description).to.equal('');

      expect(params[1].name).to.equal('obj');
      expect(params[1].type).to.equal('object');
      expect(params[1].description).to.equal('');
      expect(params[1].schema).to.exist;
      expect(params[1].schema[0].name).to.equal('name');
      expect(params[1].schema[0].defaultValue).to.equal(null);
      expect(params[1].schema[0].type).to.equal('string');
      expect(params[1].schema[1].name).to.equal('enabled');
      expect(params[1].schema[1].defaultValue).to.equal(null);
      expect(params[1].schema[1].type).to.equal('boolean');
      expect(params[1].schema[2].name).to.equal('data');
      expect(params[1].schema[2].type).to.equal('object');
      expect(params[1].schema[2].schema[0].name).to.equal('a');
      expect(params[1].schema[2].schema[0].defaultValue).to.equal(null);
      expect(params[1].schema[2].schema[0].type).to.equal('string');
      expect(params[1].schema[2].schema[1].name).to.equal('b');
      expect(params[1].schema[2].schema[1].type).to.equal('string');
      expect(params[1].schema[3].name).to.equal('timestamp');
      expect(params[1].schema[3].type).to.equal('number');

      expect(params[2].name).to.equal('after');
      expect(params[2].type).to.equal('string');
      expect(params[2].description).to.equal('');

    });

    it('Should read "schema/nested" parameters', () => {

      let params = definitions['schema/nested'].params;

      expect(params).to.deep.equal([
        {
          name: 'before',
          type: 'string',
          description: ''
        },
        {
          name: 'obj',
          type: 'object',
          description: '',
          schema: [
            {
              name: 'str',
              type: 'string',
              description: ''
            },
            {
              name: 'bool',
              type: 'boolean',
              description: ''
            },
            {
              name: 'obj',
              type: 'object',
              description: '',
              schema: [
                {
                  name: 'str',
                  type: 'string',
                  description: ''
                },
                {
                  name: 'obj',
                  type: 'object',
                  description: '',
                  schema: [
                    {
                      name: 'str',
                      type: 'string',
                      description: ''
                    }
                  ]
                }
              ]
            },
            {
              name: 'num',
              type: 'number',
              description: ''
            }
          ]
        },
        {
          name: 'after',
          type: 'string',
          description: ''
        }
      ]);

    });

    it('Should read "schema/array" parameters', () => {

      let params = definitions['schema/array'].params;

      expect(params).to.deep.equal([
        {
          name: 'arr1',
          type: 'array',
          description: '',
          schema: [
            {
              name: 'str',
              type: 'string',
              description: ''
            }
          ]
        },
        {
          name: 'arr2',
          type: 'array',
          description: '',
          schema: [
            {
              name: 'obj',
              type: 'object',
              description: '',
              schema: [
                {
                  name: 'str',
                  type: 'string',
                  description: ''
                },
                {
                  name: 'obj',
                  type: 'object',
                  description: '',
                  schema: [
                    {
                      name: 'str',
                      type: 'string',
                      description: ''
                    },

                  ]
                }
              ]
            }
          ]
        }
      ]);

    });

    it('Should read "enum_schema" parameters', () => {

      let params = definitions['enum_schema'].params;

      expect(params).to.deep.equal([
        {
          name: 'before',
          type: 'string',
          description: 'a param'
        },
        {
          name: 'valueRange',
          type: 'object',
          description: 'The data to be inserted',
          schema: [
            {
              type: 'string',
              name: 'range',
              description: ''
            },
            {
              type: 'enum',
              name: 'majorDimension',
              description: '',
              members: [
                ['ROWS', "ROWS"],
                ['COLUMNS', "COLUMNS"]
              ]
            },
            {
              type: 'array',
              name: 'values',
              description: 'An array of arrays, the outer array representing all the data and each inner array representing a major dimension. Each item in the inner array corresponds with one cell'
            }
          ]
        },
        {
          name: 'after',
          type: 'string',
          description: 'a param'
        }
      ]);

    });

    it('Should read "inline" parameters', () => {

      let params = definitions['inline'].params;
      expect(params.length).to.equal(0);

    });

    it('Should have a named return value and description', () => {

      let definition = definitions['named_return'];
      expect(definition.returns.name).to.equal('returnName');
      expect(definition.returns.description).to.equal('And a return description');

    });

    it('Should have a nullable return value', () => {

      let definition = definitions['nullable_return'];
      expect(definition.returns.description).to.equal('not sure');
      expect(definition.returns.type).to.equal('string');
      expect(definition.returns.name).to.equal('maybestring');
      expect(definition.returns.defaultValue).to.equal(null);

    });

    it('Should have a return value, description and type even with no name', () => {

      let definition = definitions['noname_return'];
      expect(definition.returns.name).to.equal('');
      expect(definition.returns.description).to.equal('');
      expect(definition.returns.type).to.equal('buffer');

    });

    it('Should read "enum" parameters', () => {

      let params = definitions['enum'].params;

      expect(params).to.deep.equal([
        {
          name: 'before',
          type: 'any',
          defaultValue: null,
          description: ''
        },
        {
          name: 'basic',
          type: 'enum',
          description: 'some basic types',
          members: [['num', 0], ['double', '1'], ['float', 1.2], ['numstr', '123']]
        },
        {
          name: 'after',
          type: 'any',
          defaultValue: null,
          description: ''
        }
      ]);

    });

    it('Should read "enum_nested" parameters', () => {

      let params = definitions['enum_nested'].params;

      expect(params).to.deep.equal([
        {
          name: 'obj',
          type: 'object',
          description: '',
          schema: [
            {
              name: 'selector',
              type: 'string',
              description: 'The selector to query'
            },
            {
              name: 'operator',
              type: 'enum',
              description: 'Which data to retrieve: can be "text", "html" or "attr"',
              members: [['text', 'text'], ['html', 'html'], ['attr', 'attr']]
            },
            {
              name: 'attr',
              type: 'string',
              defaultValue: null,
              description: 'If method is "attr", which attribute to retrieve'
            }
          ]
        },
        {
          name: 'arr',
          type: 'array',
          description: '',
          schema: [
            {
              name: 'obj',
              type: 'object',
              description: '',
              schema: [
                {
                  name: 'selector',
                  type: 'string',
                  description: 'The selector to query'
                },
                {
                  name: 'operator',
                  type: 'enum',
                  description: 'Which data to retrieve: can be "text", "html" or "attr"',
                  members: [['text', 'text'], ['html', 'html'], ['attr', 'attr']]
                },
                {
                  name: 'attr',
                  type: 'string',
                  defaultValue: null,
                  description: 'If method is "attr", which attribute to retrieve'
                }
              ]
            }
          ]
        },
        {
          name: 'obj2',
          type: 'object',
          description: '',
          schema: [
            {
              name: 'operator',
              type: 'enum',
              description: 'Which data to retrieve: can be "text", "html" or "attr"',
              members: [['text', 'text'], ['html', 'html'], ['attr', 'attr']]
            },
            {
              name: 'selector',
              type: 'string',
              description: 'The selector to query'
            },
            {
              name: 'attr',
              type: 'string',
              defaultValue: null,
              description: 'If method is "attr", which attribute to retrieve'
            }
          ]
        },
        {
          name: 'arr2',
          type: 'array',
          description: '',
          schema: [
            {
              name: 'obj',
              type: 'object',
              description: '',
              schema: [
                {
                  name: 'operator',
                  type: 'enum',
                  description: 'Which data to retrieve: can be "text", "html" or "attr"',
                  members: [['text', 'text'], ['html', 'html'], ['attr', 'attr']]
                },
                {
                  name: 'selector',
                  type: 'string',
                  description: 'The selector to query'
                },
                {
                  name: 'attr',
                  type: 'string',
                  defaultValue: null,
                  description: 'If method is "attr", which attribute to retrieve'
                }
              ]
            }
          ]
        }
      ]);

    });

    it('Should read "enum_nested_optional" parameters', () => {

      let params = definitions['enum_nested_optional'].params;

      expect(params).to.deep.equal([
        {
          name: 'descriptionHtml',
          type: 'string',
          defaultValue: null,
          description: 'The description of the product, complete with HTML formatting.'
        },
        {
          name: 'metafields',
          type: 'array',
          defaultValue: null,
          description: 'The metafields to associate with this product.',
          schema: [
            {
              name: 'MetafieldInput',
              type: 'object',
              description: 'Specifies the input fields for a metafield.',
              schema: [
                {
                  name: 'value',
                  type: 'string',
                  description: 'The value of a metafield.',
                  defaultValue: null
                },
                {
                  name: 'valueType',
                  type: 'enum',
                  description: 'Metafield value types.',
                  members: [['STRING', 'STRING'], ['INTEGER', 'INTEGER'], ['JSON_STRING', 'JSON_STRING']],
                  defaultValue: null
                }
              ]
            }
          ]
        },
        {
          name: 'privateMetafields',
          type: 'array',
          description: 'The private metafields to associated with this product.',
          defaultValue: null,
          schema: [
            {
              name: 'PrivateMetafieldInput',
              type: 'object',
              description: 'Specifies the input fields for a PrivateMetafield.',
              schema: [
                {
                  name: 'owner',
                  type: 'any',
                  description: 'The owning resource.',
                  defaultValue: null
                },
                {
                  name: 'valueInput',
                  type: 'object',
                  description: 'The value and value type of the metafield, wrapped in a ValueInput object.',
                  schema: [
                    {
                      name: 'value',
                      type: 'string',
                      description: 'The value of a private metafield.'
                    },
                    {
                      name: 'valueType',
                      type: 'enum',
                      description: 'Private Metafield value types.',
                      members: [['STRING', 'STRING'], ['INTEGER', 'INTEGER'], ['JSON_STRING', 'JSON_STRING']]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          name: 'variants',
          type: 'array',
          description: 'A list of variants associated with the product.',
          defaultValue: null,
          schema: [
            {
              name: 'ProductVariantInput',
              type: 'object',
              description: 'Specifies a product variant to create or update.',
              schema: [
                {
                  name: 'barcode',
                  type: 'string',
                  description: 'The value of the barcode associated with the product.',
                  defaultValue: null
                },
                {
                  name: 'inventoryPolicy',
                  type: 'enum',
                  description: 'The inventory policy for a product variant controls whether customers can continue to buy the variant when it is out of stock. When the value is `continue`, customers are able to buy the variant when it\'s out of stock. When the value is `deny`, customers can\'t buy the variant when it\'s out of stock.',
                  members: [['DENY', 'DENY'], ['CONTINUE', 'CONTINUE']],
                  defaultValue: null
                },
                {
                  name: 'metafields',
                  type: 'array',
                  description: 'Additional customizable information about the product variant.',
                  defaultValue: null,
                  schema: [
                    {
                      name: 'MetafieldInput',
                      type: 'object',
                      description: 'Specifies the input fields for a metafield.',
                      schema: [
                        {
                          name: 'description',
                          type: 'string',
                          description: 'The description of the metafield .',
                          defaultValue: null
                        },
                        {
                          name: 'valueType',
                          type: 'enum',
                          description: 'Metafield value types.',
                          members: [['STRING', 'STRING'], ['INTEGER', 'INTEGER'], ['JSON_STRING', 'JSON_STRING']],
                          defaultValue: null
                        }
                      ]
                    }
                  ]
                },
                {
                  name: 'privateMetafields',
                  type: 'array',
                  description: 'The private metafields to associated with this product.',
                  defaultValue: null,
                  schema: [
                    {
                      name: 'PrivateMetafieldInput',
                      type: 'object',
                      description: 'Specifies the input fields for a PrivateMetafield.',
                      schema: [
                        {
                          name: 'owner',
                          type: 'any',
                          description: 'The owning resource.',
                          defaultValue: null
                        },
                        {
                          name: 'valueInput',
                          type: 'object',
                          description: 'The value and value type of the metafield, wrapped in a ValueInput object.',
                          schema: [
                            {
                              name: 'value',
                              type: 'string',
                              description: 'The value of a private metafield.'
                            },
                            {
                              name: 'valueType',
                              type: 'enum',
                              description: 'Private Metafield value types.',
                              members: [['STRING', 'STRING'], ['INTEGER', 'INTEGER'], ['JSON_STRING', 'JSON_STRING']]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  name: 'taxCode',
                  type: 'string',
                  description: 'The tax code associated with the variant.',
                  defaultValue: null
                },
                {
                  name: 'weightUnit',
                  type: 'enum',
                  description: 'Units of measurement for weight.',
                  members: [['KILOGRAMS', 'KILOGRAMS'], ["GRAMS", "GRAMS"], ["POUNDS", "POUNDS"], ["OUNCES", "OUNCES"]],
                  defaultValue: null
                }
              ]
            }
          ]
        },
        {
          name: 'media',
          type: 'array',
          description: 'List of new media to be added to the product.',
          defaultValue: null,
          schema: [
            {
              name: 'CreateMediaInput',
              type: 'object',
              description: 'Specifies the input fields required to create a media object.',
              schema: [
                {
                  name: 'originalSource',
                  type: 'string',
                  description: 'The original source of the media object. May be an external URL or signed upload URL.'
                },
                {
                  name: 'mediaContentType',
                  type: 'enum',
                  description: 'The possible content types for a media object.',
                  members: [['VIDEO', 'VIDEO'], ['EXTERNAL_VIDEO', 'EXTERNAL_VIDEO'], ['MODEL_3D', 'MODEL_3D'], ['IMAGE', 'IMAGE']]
                }
              ]
            }
          ]
        }
      ]);

    });

    it('Should read "options" parameters', () => {

      let params = definitions['options'].params;
      expect(params.length).to.equal(2);

      expect(params[0].name).to.equal('database');
      expect(params[0].type).to.equal('string');
      expect(params[0].description).to.equal('A database');
      expect(params[0].defaultMetafield).to.equal('db.databaseId');
      expect(params[0].options).to.exist;
      expect(Object.keys(params[0].options).length).to.equal(2);
      expect(params[0].options.lib).to.equal('db.schema.databases.list');
      expect(params[0].options.extract).to.exist;
      expect(params[0].options.extract.labels).to.equal('$[].name');
      expect(params[0].options.extract.values).to.equal('$[].id');

      expect(params[1].name).to.equal('table');
      expect(params[1].type).to.equal('string');
      expect(params[1].description).to.equal('A table');
      expect(Object.keys(params[1].options).length).to.equal(3);
      expect(params[1].options.lib).to.equal('db.schema.databases.retrieve');
      expect(params[1].options.map).to.exist;
      expect(Object.keys(params[1].options.map).length).to.equal(1);
      expect(params[1].options.map).to.haveOwnProperty('databaseId');
      expect(params[1].options.map.databaseId).to.equal('database');
      expect(params[1].options.extract).to.exist;
      expect(params[1].options.extract.labels).to.equal('$[].name');
      expect(params[1].options.extract.values).to.equal('$[].name');

    });

    it('Should read "options" parameters in keyql', () => {

      let params = definitions['keyql_options'].params;
      expect(params.length).to.equal(3);

      expect(params[0].name).to.equal('query');
      expect(params[0].type).to.equal('object.keyql.query');
      expect(params[0].description).to.equal('Query API based on these parameters');
      expect(params[0].options).to.exist;
      expect(Object.keys(params[0].options).length).to.equal(1);
      expect(params[0].options.values).to.be.an('array');
      expect(params[0].options.values.length).to.equal(3);
      expect(params[0].options.values[0]).to.equal('status');
      expect(params[0].options.values[1]).to.equal('hello');
      expect(params[0].options.values[2]).to.equal('goodbye');

      expect(params[1].name).to.equal('query2');
      expect(params[1].type).to.equal('object.keyql.query');
      expect(params[1].description).to.equal('Query API based on these parameters');
      expect(params[1].options).to.exist;
      expect(Object.keys(params[1].options).length).to.equal(2);
      expect(params[1].options.lib).to.equal('db.schema.database.fields');
      expect(params[1].options.extract).to.exist;
      expect(params[1].options.extract.labels).to.equal('$.fields[].name');
      expect(params[1].options.extract.values).to.equal('$.fields[].id');

      expect(params[2].name).to.equal('keyqlquery');
      expect(params[2].type).to.equal('array');
      expect(params[2].schema).to.exist;
      expect(params[2].schema.length).to.equal(1);
      expect(params[2].schema[0].name).to.equal('queryobj');
      expect(params[2].schema[0].type).to.equal('object.keyql.query');
      expect(params[2].schema[0].description).to.equal('Query API based on these parameters');
      expect(params[2].schema[0].options).to.exist;
      expect(Object.keys(params[2].schema[0].options).length).to.equal(1);
      expect(params[2].schema[0].options.values).to.be.an('array');
      expect(params[2].schema[0].options.values.length).to.equal(3);
      expect(params[2].schema[0].options.values[0]).to.equal('status');
      expect(params[2].schema[0].options.values[1]).to.equal('hello');
      expect(params[2].schema[0].options.values[2]).to.equal('goodbye');

    });

    it('Should read "alternate_schemas" parameters', () => {

      let params = definitions['alternate_schemas'].params;
      let returns = definitions['alternate_schemas'].returns;
      let schemaCheck = [
        {
          name: 'fileOrFolder',
          description: '',
          type: 'object',
          schema: [
            {
              name: 'name',
              description: '',
              type: 'string'
            },
            {
              name: 'size',
              description: '',
              type: 'integer'
            }
          ],
          alternateSchemas: [
            [
              {
                name: 'name',
                description: '',
                type: 'string'
              },
              {
                name: 'files',
                description: '',
                type: 'array'
              },
              {
                name: 'options',
                description: '',
                type: 'object',
                schema: [
                  {
                    name: 'type',
                    description: '',
                    type: 'string'
                  }
                ],
                alternateSchemas: [
                  [
                    {
                      name: 'type',
                      description: '',
                      type: 'number'
                    }
                  ]
                ]
              }
            ]
          ]
        }
      ];

      expect(params).to.deep.equal(schemaCheck);
      expect(returns).to.deep.equal(schemaCheck[0]);

    });

  });

  describe('Types', () => {

    it('should validate "string"', () => {

      expect(types.validate('string', 'abc')).to.equal(true);
      expect(types.validate('string', 1)).to.equal(false);
      expect(types.validate('string', 1.1)).to.equal(false);
      expect(types.validate('string', 1e300)).to.equal(false);
      expect(types.validate('string', true)).to.equal(false);
      expect(types.validate('string', {})).to.equal(false);
      expect(types.validate('string', [])).to.equal(false);
      expect(types.validate('string', Buffer.from([]))).to.equal(false);

      expect(types.validate('string', null)).to.equal(false);
      expect(types.validate('string', null, true)).to.equal(true);

    });

    it('should validate "number"', () => {

      expect(types.validate('number', 'abc')).to.equal(false);
      expect(types.validate('number', 1)).to.equal(true);
      expect(types.validate('number', 1.1)).to.equal(true);
      expect(types.validate('number', 1e300)).to.equal(true);
      expect(types.validate('number', true)).to.equal(false);
      expect(types.validate('number', {})).to.equal(false);
      expect(types.validate('number', [])).to.equal(false);
      expect(types.validate('number', Buffer.from([]))).to.equal(false);

      expect(types.validate('number', null)).to.equal(false);
      expect(types.validate('number', null, true)).to.equal(true);

    });

    it('should validate "float"', () => {

      expect(types.validate('float', 'abc')).to.equal(false);
      expect(types.validate('float', 1)).to.equal(true);
      expect(types.validate('float', 1.1)).to.equal(true);
      expect(types.validate('float', 1e300)).to.equal(true);
      expect(types.validate('float', true)).to.equal(false);
      expect(types.validate('float', {})).to.equal(false);
      expect(types.validate('float', [])).to.equal(false);
      expect(types.validate('float', Buffer.from([]))).to.equal(false);

      expect(types.validate('float', null)).to.equal(false);
      expect(types.validate('float', null, true)).to.equal(true);

    });

    it('should validate "integer"', () => {

      expect(types.validate('integer', 'abc')).to.equal(false);
      expect(types.validate('integer', 1)).to.equal(true);
      expect(types.validate('integer', 1.1)).to.equal(false);
      expect(types.validate('integer', 1e300)).to.equal(false);
      expect(types.validate('integer', true)).to.equal(false);
      expect(types.validate('integer', {})).to.equal(false);
      expect(types.validate('integer', [])).to.equal(false);
      expect(types.validate('integer', Buffer.from([]))).to.equal(false);

      expect(types.validate('integer', null)).to.equal(false);
      expect(types.validate('integer', null, true)).to.equal(true);

    });

    it('should validate "boolean"', () => {

      expect(types.validate('boolean', 'abc')).to.equal(false);
      expect(types.validate('boolean', 1)).to.equal(false);
      expect(types.validate('boolean', 1.1)).to.equal(false);
      expect(types.validate('boolean', 1e300)).to.equal(false);
      expect(types.validate('boolean', true)).to.equal(true);
      expect(types.validate('boolean', {})).to.equal(false);
      expect(types.validate('boolean', [])).to.equal(false);
      expect(types.validate('boolean', Buffer.from([]))).to.equal(false);

      expect(types.validate('boolean', null)).to.equal(false);
      expect(types.validate('boolean', null, true)).to.equal(true);

    });

    it('should validate "object"', () => {

      expect(types.validate('object', 'abc')).to.equal(false);
      expect(types.validate('object', 1)).to.equal(false);
      expect(types.validate('object', 1.1)).to.equal(false);
      expect(types.validate('object', 1e300)).to.equal(false);
      expect(types.validate('object', true)).to.equal(false);
      expect(types.validate('object', {})).to.equal(true);
      expect(types.validate('object', [])).to.equal(false);
      expect(types.validate('object', Buffer.from([]))).to.equal(false);

      expect(types.validate('object', null)).to.equal(false);
      expect(types.validate('object', null, true)).to.equal(true);

    });

    it('should validate "array"', () => {

      expect(types.validate('array', 'abc')).to.equal(false);
      expect(types.validate('array', 1)).to.equal(false);
      expect(types.validate('array', 1.1)).to.equal(false);
      expect(types.validate('array', 1e300)).to.equal(false);
      expect(types.validate('array', true)).to.equal(false);
      expect(types.validate('array', {})).to.equal(false);
      expect(types.validate('array', [])).to.equal(true);
      expect(types.validate('array', Buffer.from([]))).to.equal(false);

      expect(types.validate('array', null)).to.equal(false);
      expect(types.validate('array', null, true)).to.equal(true);

    });

    it('should validate "buffer"', () => {

      expect(types.validate('buffer', 'abc')).to.equal(false);
      expect(types.validate('buffer', 1)).to.equal(false);
      expect(types.validate('buffer', 1.1)).to.equal(false);
      expect(types.validate('buffer', 1e300)).to.equal(false);
      expect(types.validate('buffer', true)).to.equal(false);
      expect(types.validate('buffer', {})).to.equal(false);
      expect(types.validate('buffer', [])).to.equal(false);
      expect(types.validate('buffer', Buffer.from([]))).to.equal(true);

      expect(types.validate('buffer', null)).to.equal(false);
      expect(types.validate('buffer', null, true)).to.equal(true);

    });

    it('should validate "any"', () => {

      expect(types.validate('any', 'abc')).to.equal(true);
      expect(types.validate('any', 1)).to.equal(true);
      expect(types.validate('any', 1.1)).to.equal(true);
      expect(types.validate('any', 1e300)).to.equal(true);
      expect(types.validate('any', true)).to.equal(true);
      expect(types.validate('any', {})).to.equal(true);
      expect(types.validate('any', [])).to.equal(true);
      expect(types.validate('any', Buffer.from([]))).to.equal(true);

      expect(types.validate('any', null)).to.equal(true);
      expect(types.validate('any', null, true)).to.equal(true);

    });

    it('Should validate "enum"', () => {

      let members = [
        ['sunday', 0],
        ['1', 1],
        ['1.1', 2],
        ['1e300', 3],
        ['true', 4],
        ['{}', 5],
        ['[]', 6],
        ['Buffer.from([])', 7],
        ['null', 8]
      ];

      expect(types.validate('enum', 'sunday', false, members)).to.equal(true);
      expect(types.validate('enum', '1', false, members)).to.equal(true);
      expect(types.validate('enum', '1.1', false, members)).to.equal(true);
      expect(types.validate('enum', '1e300', false, members)).to.equal(true);
      expect(types.validate('enum', 'true', false, members)).to.equal(true);
      expect(types.validate('enum', '{}', false, members)).to.equal(true);
      expect(types.validate('enum', '[]', false, members)).to.equal(true);
      expect(types.validate('enum', 'Buffer.from([])', false, members)).to.equal(true);
      expect(types.validate('enum', 'null', false, members)).to.equal(true);
      expect(types.validate('enum', null, true, members)).to.equal(true);

      expect(types.validate('enum', 'abc', false, members)).to.equal(false);
      expect(types.validate('enum', 1, false, members)).to.equal(false);
      expect(types.validate('enum', 1.1, false, members)).to.equal(false);
      expect(types.validate('enum', 1e300, false, members)).to.equal(false);
      expect(types.validate('enum', true, false, members)).to.equal(false);
      expect(types.validate('enum', {}, false, members)).to.equal(false);
      expect(types.validate('enum', [], false, members)).to.equal(false);
      expect(types.validate('enum', Buffer.from([]), false, members)).to.equal(false);
      expect(types.validate('enum', null, false, members)).to.equal(false);

    });

    it('Should validate an "object" with a schema that has a "enum" member', () => {

      expect(
        types.validate('object', { offset: '0 minutes' }, false, [
          [
            {
              name: 'offset',
              type: 'enum',
              description: `How many minutes past the start of each hour you would like your API to execute`,
              members: [
                ['0 minutes', 0],
                ['15 minutes', 60 * 15],
                ['30 minutes', 60 * 30],
                ['45 minutes', 60 * 45]
              ]
            }
          ]
        ])
      ).to.equal(true);

      expect(
        types.validate('object', { offset: '0 min' }, false, [
          [
            {
              name: 'offset',
              type: 'enum',
              description: `How many minutes past the start of each hour you would like your API to execute`,
              members: [
                ['0 minutes', 0],
                ['15 minutes', 60 * 15],
                ['30 minutes', 60 * 30],
                ['45 minutes', 60 * 45]
              ]
            }
          ]
        ])
      ).to.equal(false);

    });

    it('Should validate an "array" with a schema that has a "enum" member', () => {

      expect(
        types.validate('array', ['0 minutes'], false, [
          [
            {
              name: 'offset',
              type: 'enum',
              description: `How many minutes past the start of each hour you would like your API to execute`,
              members: [
                ['0 minutes', 0],
                ['15 minutes', 60 * 15],
                ['30 minutes', 60 * 30],
                ['45 minutes', 60 * 45]
              ]
            }
          ]
        ])
      ).to.equal(true);

      expect(
        types.validate('array', ['0 min'], false, [
          [
            {
              name: 'offset',
              type: 'enum',
              description: `How many minutes past the start of each hour you would like your API to execute`,
              members: [
                ['0 minutes', 0],
                ['15 minutes', 60 * 15],
                ['30 minutes', 60 * 30],
                ['45 minutes', 60 * 45]
              ]
            }
          ]
        ])
      ).to.equal(false);

    });

    it('should validate "object" with schema', () => {

      expect(types.validate('object', {})).to.equal(true);
      expect(
        types.validate(
          'object',
          {},
          false,
          [
            [
              {name: 'hello', type: 'string'}
            ]
          ]
        )
      ).to.equal(false);
      expect(
        types.validate(
          'object',
          {
            hello: 'what'
          },
          false,
          [
            [
              {name: 'hello', type: 'string'}
            ]
          ]
        )
      ).to.equal(true);

      let testSchema = [
        {name: 'hello', type: 'string'},
        {name: 'data', type: 'object', schema: [
          {name: 'a', type: 'string'},
          {name: 'b', type: 'string'}
        ]},
        {name: 'tf', type: 'boolean'}
      ];

      expect(
        types.validate(
          'object',
          {},
          false,
          [testSchema]
        )
      ).to.equal(false);
      expect(
        types.validate(
          'object',
          {
            hello: 'hey',
          },
          false,
          [testSchema]
        )
      ).to.equal(false);
      expect(
        types.validate(
          'object',
          {
            hello: 'hey',
            data: {a: 'a', b: 'b'},
            tf: true
          },
          false,
          [testSchema]
        )
      ).to.equal(true);
      expect(
        types.validate(
          'object',
          {
            hello: 'hey',
            data: {a: 1, b: 'b'},
            tf: true
          },
          false,
          [testSchema]
        )
      ).to.equal(false);


      expect(types.validate('object', null)).to.equal(false);
      expect(types.validate('object', null, true)).to.equal(true);

    });

    it('should validate "object.keyql.query"', () => {

      expect(
        types.validate('object.keyql.query', {
          first_name: 'Dolores',
          eye_color__in: ['blue', 'green']
        })
      ).to.equal(true);

    });

    it('should validate "object.keyql.limit"', () => {

      expect(
        types.validate('object.keyql.limit', {
          offset: 0,
          limit: 0
        })
      ).to.equal(true);

    });

    it('should sanitize "object.keyql.query"', () => {

      try {
        types.sanitize('object.keyql.query', {
          first_name: 'Dolores',
          eye_color__in: ['blue', 'green']
        });
      } catch (err) {
        expect(err).to.not.exist;
      }

    });

    it('should sanitize "object.keyql.limit"', () => {

      try {
        types.sanitize('object.keyql.limit', {
          first_name: 'Dolores',
          eye_color__in: ['blue', 'green']
        });
      } catch (err) {
        expect(err).to.exist;
      }

      try {
        types.sanitize('object.keyql.limit', {
          count: 0,
          offset: 0
        });
      } catch (err) {
        expect(err).to.not.exist;
      }

    });

    it('should convert types from strings', () => {

      expect(types.convert('number', '1e300')).to.equal(1e300);
      expect(types.convert('float', '100.1')).to.equal(100.1);
      expect(types.convert('integer', '100')).to.equal(100);
      expect(types.convert('boolean', 'f')).to.equal(false);
      expect(types.convert('boolean', 'false')).to.equal(false);
      expect(types.convert('boolean', 't')).to.equal(true);
      expect(types.convert('boolean', 'true')).to.equal(true);
      expect(types.convert('object', '{"a":1}')).to.deep.equal({a: 1});
      expect(types.convert('array', '[1,2,3]')).to.deep.equal([1, 2, 3]);
      expect(types.convert('buffer', '{"_bytes":[1,2]}')).to.be.instanceof(Buffer);
      expect(types.convert('buffer', '{"_base64":"Y2FyZWVyc0BzdGRsaWIuY29t"}')).to.be.instanceof(Buffer);

    });

    it('should check types', () => {

      expect(types.check()).to.equal('any');
      expect(types.check(null)).to.equal('any');
      expect(types.check('hello')).to.equal('string');
      expect(types.check(1e300)).to.equal('number');
      expect(types.check(100.1)).to.equal('number');
      expect(types.check(100)).to.equal('number');
      expect(types.check(true)).to.equal('boolean');
      expect(types.check(false)).to.equal('boolean');
      expect(types.check({})).to.equal('object');
      expect(types.check([])).to.equal('array');
      expect(types.check(Buffer.from([]))).to.equal('buffer');

    });

    it('should introspect basic types', () => {

      expect(types.introspect(null)).to.deep.equal({
        type: 'any',
        defaultValue: null
      });
      expect(types.introspect(4)).to.deep.equal({
        type: 'number'
      });
      expect(types.introspect('hello')).to.deep.equal({
        type: 'string'
      });
      expect(types.introspect(Buffer.from(Array(99)))).to.deep.equal({
        type: 'buffer'
      });
      expect(types.introspect({a: 'a', b: 'b', c: null, d: 4})).to.deep.equal({
        type: 'object',
        schema: [{
          name: 'a',
          type: 'string',
          sampleValue: 'a'
        }, {
          name: 'b',
          type: 'string',
          sampleValue: 'b'
        }, {
          name: 'c',
          type: 'any',
          defaultValue: null
        }, {
          name: 'd',
          type: 'number',
          sampleValue: 4
        }]
      });
      expect(types.introspect([1, 2, 3])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'number'
        }]
      });
      expect(types.introspect([['one', 'two', 'three'], ['four'], ['five', 'six']])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'array',
          schema: [{
            type: 'string'
          }]
        }]
      });

    });

    it('Should introspect a nested object', () => {

      expect(
        types.introspect({
          hello: 'hey',
          data: {a: 'a', b: 'b'},
          nestedArray: [{c: 'c', d: 'd'}, {c: 'c', e: 'e'}],
          deeplyNestedArray: [
            [{f: 'f', g: 'g'}, {f: 'f', g: 'g'}, {g: 'g', h: 'h'}],
            [{f: 'f', g: 'g'}, {g: 'g', h: 'h'}, {g: 'g', h: 'h'}]
          ],
          tf: true
        })
      ).to.deep.equal({
        type: 'object',
        schema: [{
          name: 'hello',
          type: 'string',
          sampleValue: 'hey'
        }, {
          name: 'data',
          type: 'object',
          schema: [{
            name: 'a',
            type: 'string',
            sampleValue: 'a'
          }, {
            name: 'b',
            type: 'string',
            sampleValue: 'b'
          }]
        }, {
          name: 'nestedArray',
          type: 'array',
          schema: [{
            type: 'object',
            schema: [{
              type: 'string',
              name: 'c',
              sampleValue: 'c'
            }]
          }]
        }, {
          name: 'deeplyNestedArray',
          type: 'array',
          schema: [{
            type: 'array',
            schema: [{
              type: 'object',
              schema: [{
                type: 'string',
                name: 'g',
                sampleValue: 'g'
              }]
            }]
          }]
        }, {
          name: 'tf',
          type: 'boolean',
          sampleValue: true
        }]
      });

    });

    it('Should introspect heterogenous arrays', () => {

      expect(types.introspect(['one', 2, 3, 4])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'any'
        }]
      });
      expect(types.introspect({
        nested: ['one', 2, 3, 4],
        a: Buffer.from([])
      })).to.deep.equal({
        type: 'object',
        schema: [{
          type: 'array',
          name: 'nested',
          schema: [{
            type: 'any'
          }]
        }, {
          type: 'buffer',
          name: 'a',
          sampleValue: Buffer.from([])
        }]
      });

    });

    it('Should introspect more complex nullable values properly', () => {

      expect(types.introspect([1, 2, null, 4])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'number',
          defaultValue: null
        }]
      });
      expect(types.introspect([null, null, 1, null, 2, 3])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'number',
          defaultValue: null
        }]
      });
      expect(types.introspect([null])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'any',
          defaultValue: null
        }]
      });
      expect(types.introspect([1, 'two', null, 4])).to.deep.equal({
        type: 'array',
        schema: [{
          type: 'any',
          defaultValue: null
        }]
      });
      expect(types.introspect({
        nested: ['one', 2, 3, null],
        nestedObjects: [{
          one: 'one',
          two: 2,
          three: 3,
          four: 4,
          five: 'five'
        }, {
          one: null,
          two: null,
          three: null,
          four: 44,
          five: '5ive'
        }, {
          one: 'uno',
          two: 2,
          three: 'three',
          four: 444
        }]
      })).to.deep.equal({
        type: 'object',
        schema: [{
          type: 'array',
          name: 'nested',
          schema: [{
            type: 'any',
            defaultValue: null
          }]
        }, {
          type: 'array',
          name: 'nestedObjects',
          schema: [{
            type: 'object',
            schema: [{
              name: 'one',
              type: 'any',
              defaultValue: null,
              sampleValue: 'one'
            }, {
              name: 'two',
              type: 'any',
              defaultValue: null,
              sampleValue: 2
            }, {
              name: 'three',
              type: 'any',
              defaultValue: null,
              sampleValue: 3
            },
            {
              name: 'four',
              type: 'number',
              sampleValue: 4
            }]
          }]
        }]
      });

    });

    it('Should parse valid Node.js variable names', () => {

      expect(NodeJsFunctionParser.validateFunctionParamName('test')).to.equal(true);
      expect(NodeJsFunctionParser.validateFunctionParamName('$pécial_character$$')).to.equal(true);

    });

    it('Should fail to parse invalid Node.js variable names', () => {

      expect(NodeJsFunctionParser.validateFunctionParamName('with spaces')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('2*2')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('2')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('[]')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('{}')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('{object: literal}')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName({})).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName(2)).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('2+2')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('let')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('const')).to.equal(false);
      expect(NodeJsFunctionParser.validateFunctionParamName('delete')).to.equal(false);

    });

  });

  describe('Gateway', () => {

    require('./gateway/tests.js')(expect);

  });

});
