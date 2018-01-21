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

    it('Should read all functions correctly', () => {

      expect(Object.keys(definitions).length).to.equal(7);
      expect(definitions).to.haveOwnProperty('');
      expect(definitions).to.haveOwnProperty('test');
      expect(definitions).to.haveOwnProperty('returns');
      expect(definitions).to.haveOwnProperty('default');
      expect(definitions).to.haveOwnProperty('dir/test');
      expect(definitions).to.haveOwnProperty('dir/sub');
      expect(definitions).to.haveOwnProperty('dir/sub/test');

    });

    it('Should have correct filenames', () => {

      expect(definitions[''].pathname).to.equal('__main__.js');
      expect(definitions['test'].pathname).to.equal('test.js');
      expect(definitions['returns'].pathname).to.equal('returns.js');
      expect(definitions['default'].pathname).to.equal('default.js');
      expect(definitions['dir/test'].pathname).to.equal('dir/test.js');
      expect(definitions['dir/sub'].pathname).to.equal('dir/sub/__main__.js');
      expect(definitions['dir/sub/test'].pathname).to.equal('dir/sub/test.js');

    });

    it('Should have correct descriptions', () => {

      expect(definitions[''].description).to.equal('');
      expect(definitions['test'].description).to.equal('Test function');
      expect(definitions['returns'].description).to.equal('');
      expect(definitions['default'].description).to.equal('Test default parameters');
      expect(definitions['dir/test'].description).to.equal('');
      expect(definitions['dir/sub'].description).to.equal('Test function');
      expect(definitions['dir/sub/test'].description).to.equal('');

    });

    it('Should have correct context', () => {

      expect(definitions[''].context).to.equal(null);
      expect(definitions['test'].context).to.exist;
      expect(definitions['returns'].context).to.equal(null);
      expect(definitions['default'].context).to.exist;
      expect(definitions['dir/test'].context).to.exist;
      expect(definitions['dir/sub'].context).to.equal(null);
      expect(definitions['dir/sub/test'].context).to.exist;

    });

    it('Should have correct returns descriptions', () => {

      expect(definitions[''].returns.description).to.equal('');
      expect(definitions['test'].returns.description).to.equal('');
      expect(definitions['returns'].returns.description).to.equal('hello');
      expect(definitions['default'].returns.description).to.equal('');
      expect(definitions['dir/test'].returns.description).to.equal('');
      expect(definitions['dir/sub'].returns.description).to.equal('A return value!');
      expect(definitions['dir/sub/test'].returns.description).to.equal('');

    });

    it('Should have correct returns types', () => {

      expect(definitions[''].returns.type).to.equal('any');
      expect(definitions['test'].returns.type).to.equal('boolean');
      expect(definitions['returns'].returns.type).to.equal('number');
      expect(definitions['default'].returns.type).to.equal('string');
      expect(definitions['dir/test'].returns.type).to.equal('any');
      expect(definitions['dir/sub'].returns.type).to.equal('boolean');
      expect(definitions['dir/sub/test'].returns.type).to.equal('any');

    });

    it('Should have correct charge value', () => {

      expect(definitions[''].charge).to.equal(1);
      expect(definitions['test'].charge).to.equal(0);
      expect(definitions['returns'].charge).to.equal(1);
      expect(definitions['default'].charge).to.equal(1);
      expect(definitions['dir/test'].charge).to.equal(1);
      expect(definitions['dir/sub'].charge).to.equal(19);
      expect(definitions['dir/sub/test'].charge).to.equal(1);

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
      expect(types.validate('string', new Buffer(0))).to.equal(false);

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
      expect(types.validate('number', new Buffer(0))).to.equal(false);

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
      expect(types.validate('float', new Buffer(0))).to.equal(false);

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
      expect(types.validate('integer', new Buffer(0))).to.equal(false);

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
      expect(types.validate('boolean', new Buffer(0))).to.equal(false);

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
      expect(types.validate('object', new Buffer(0))).to.equal(false);

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
      expect(types.validate('array', new Buffer(0))).to.equal(false);

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
      expect(types.validate('buffer', new Buffer(0))).to.equal(true);

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
      expect(types.validate('any', new Buffer(0))).to.equal(true);

      expect(types.validate('any', null)).to.equal(true);
      expect(types.validate('any', null, true)).to.equal(true);

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
      expect(types.check(new Buffer(0))).to.equal('buffer');

    });

  });

  describe('Gateway', () => {

    require('./gateway/tests.js')(expect);

  });

});
