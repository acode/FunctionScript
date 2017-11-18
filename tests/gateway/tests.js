const http = require('http');
const {Gateway, FunctionParser} = require('../../index.js');

const PORT = 7357;
const HOST = 'localhost'
const ROOT = './tests/gateway';

const FaaSGateway = new Gateway({debug: true, root: ROOT});
const parser = new FunctionParser();

function request(method, headers, path, data, callback) {
  headers = headers || {};
  method = method || 'GET';
  path = path || '';
  path = path.startsWith('/') ? path : `/${path}`;
  if (typeof data === 'object') {
    data = JSON.stringify(data);
    headers['Content-Type'] = 'application/json';
  } else if (typeof data === 'string') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  data = data || '';
  let req = http.request({
    host: HOST,
    port: PORT,
    path: path,
    method: method,
    headers: headers
  }, (res) => {
    let buffers = [];
    res.on('data', chunk => buffers.push(chunk));
    res.on('end', () => {
      let result = Buffer.concat(buffers);
      if ((res.headers['content-type'] || '').split(';')[0] === 'application/json') {
        result = JSON.parse(result.toString());
      }
      callback(null, res, result);
    });
    res.on('error', err => callback(err));
  });
  req.end(data);
}

module.exports = (expect) => {

  before(() => {
    FaaSGateway.listen(PORT);
    FaaSGateway.define(parser.load(ROOT, 'functions'));
  });

  it('Should setup correctly', () => {

    expect(FaaSGateway.server).to.exist;
    expect(FaaSGateway.definitions).to.exist;
    expect(FaaSGateway.definitions).to.haveOwnProperty('my_function');

  });

  it('Should return 404 + ClientError for not found function', done => {
    request('GET', {}, '/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(404);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ClientError');
      done();

    });
  });

  it('Should return 302 redirect when missing trailing / with user agent', done => {
    request('GET', {'user-agent': 'testing'}, '/my_function', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(res.headers).to.haveOwnProperty('location');
      expect(res.headers.location).to.equal('/my_function/');
      done();

    });
  });

  it('Should not return 302 redirect when missing trailing / without user agent', done => {
    request('GET', {}, '/my_function', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.not.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      done();

    });
  });

  it('Should give 200 OK and property headers for OPTIONS', done => {
    request('OPTIONS', {}, '/my_function/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      done();

    });
  });

  it('Should return 200 OK when no Content-Type specified on GET', done => {
    request('GET', {}, '/my_function/', undefined, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(6);
      done();

    });
  });

  it('Should return 400 Bad Request + ClientError when no Content-Type specified on POST', done => {
    request('POST', {}, '/my_function/', undefined, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ClientError');
      done();

    });
  });

  it('Should return 200 OK + result when executed', done => {
    request('GET', {}, '/my_function/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(6);
      done();

    });
  });

  it('Should parse arguments from URL', done => {
    request('GET', {}, '/my_function/?a=10&b=20&c=30', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(60);
      done();

    });
  });

  it('Should parse arguments from POST (URL encoded)', done => {
    request('POST', {}, '/my_function/', 'a=10&b=20&c=30', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(60);
      done();

    });
  });

  it('Should not overwrite POST (URL encoded) data with query parameters', done => {
    request('POST', {}, '/my_function/?c=300', 'a=10&b=20&c=30', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ClientError');
      done();

    });
  });

  it('Should parse arguments from POST (JSON)', done => {
    request('POST', {}, '/my_function/', {a: 10, b: 20, c: 30}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(60);
      done();

    });
  });

  it('Should not overwrite POST (JSON) data with query parameters', done => {
    request('POST', {}, '/my_function/?c=300', {a: 10, b: 20, c: 30}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ClientError');
      done();

    });
  });

  it('Should parse arguments from POST (JSON Array)', done => {
    request('POST', {}, '/my_function/', [10, 20, 30], (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(60);
      done();

    });
  });

  it('Should not overwrite POST (JSON Array) data with query parameters', done => {
    request('POST', {}, '/my_function/?c=300', [10, 20, 30], (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ClientError');
      done();

    });
  });

  it('Should give ParameterError if parameter doesn\'t match (converted)', done => {
    request('POST', {}, '/my_function/', 'a=10&b=20&c=hello%20world', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.c).to.exist;
      expect(result.error.details.c.expected).to.exist;
      expect(result.error.details.c.expected.type).to.equal('number');
      expect(result.error.details.c.actual).to.exist;
      expect(result.error.details.c.actual.type).to.equal('string');
      expect(result.error.details.c.actual.value).to.equal('hello world');
      done();

    });
  });

  it('Should give ParameterError if parameter doesn\'t match (not converted)', done => {
    request('POST', {}, '/my_function/', {a: 10, b: 20, c: '30'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.c).to.exist;
      expect(result.error.details.c.expected).to.exist;
      expect(result.error.details.c.expected.type).to.equal('number');
      expect(result.error.details.c.actual).to.exist;
      expect(result.error.details.c.actual.type).to.equal('string');
      expect(result.error.details.c.actual.value).to.equal('30');
      done();

    });
  });

  it('Should give 502 + ValueError if unexpected value', done => {
    request('POST', {}, '/my_function/', {c: 100}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ValueError');
      expect(result.error.details).to.exist;
      expect(result.error.details.returns).to.exist;
      expect(result.error.details.returns.message).to.exist;
      expect(result.error.details.returns.expected).to.exist;
      expect(result.error.details.returns.expected.type).to.equal('number');
      expect(result.error.details.returns.actual).to.exist;
      expect(result.error.details.returns.actual.type).to.equal('string');
      expect(result.error.details.returns.actual.value).to.equal('hello value');
      done();

    });
  });

  it('Should give 200 OK for not found function', done => {
    request('POST', {}, '/test/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal('not found?');
      done();

    });
  });

  it('Should allow status setting from third callback parameter', done => {
    request('POST', {}, '/test/status/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(404);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('not found');
      done();

    });
  });

  it('Should pass headers properly', done => {
    request('POST', {}, '/headers/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(res.headers['content-type']).to.equal('text/html');
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('abcdef');
      done();

    });
  });

  it('Should parse object properly', done => {
    request('POST', {}, '/object_parsing/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(null);
      done();

    });
  });

  it('Should error object on string provided', done => {
    request('POST', {}, '/object_parsing/', {obj: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.obj).to.exist;
      expect(result.error.details.obj.message).to.exist;
      expect(result.error.details.obj.expected).to.exist;
      expect(result.error.details.obj.expected.type).to.equal('object');
      expect(result.error.details.obj.actual).to.exist;
      expect(result.error.details.obj.actual.type).to.equal('string');
      expect(result.error.details.obj.actual.value).to.equal('xxx');
      done();

    });
  });

  it('Should run a background function', done => {
    request('POST', {}, '/bg/:bg', {data: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.length).to.be.greaterThan(0);
      done();

    });
  });

  it('Should return 302 redirect with correct url when running a background function missing a slash before :bg and at end of url', done => {
    request('POST', {'user-agent': 'testing'}, '/bg:bg', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(res.headers).to.haveOwnProperty('location');
      expect(res.headers.location).to.equal('/bg/:bg');
      done();

    });
  });

  it('Should return 302 redirect with correct url when running a background function missing a slash before :bg but with slash at end of url', done => {
    request('POST', {'user-agent': 'testing'}, '/bg:bg/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(res.headers).to.haveOwnProperty('location');
      expect(res.headers.location).to.equal('/bg/:bg');
      done();

    });
  });

  it('Should return 302 redirect with correct url when running a background function missing a slash before :bg and at end of url with a query', done => {
    request('POST', {'user-agent': 'testing'}, '/bg:bg?test=param', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(res.headers).to.haveOwnProperty('location');
      expect(res.headers.location).to.equal('/bg/:bg?test=param');
      done();

    });
  });

  it('Should return 302 redirect with correct url when running a background function missing a slash before :bg but with slash at end of url with a query', done => {
    request('POST', {'user-agent': 'testing'}, '/bg:bg/?test=param', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(res.headers).to.haveOwnProperty('location');
      expect(res.headers.location).to.equal('/bg/:bg?test=param');
      done();

    });
  });

  it('Should run a background function with bg mode "info"', done => {
    request('POST', {}, '/bg/info/:bg', {data: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.length).to.be.greaterThan(0);
      done();

    });
  });

  it('Should run a background function with bg mode "empty"', done => {
    request('POST', {}, '/bg/empty/:bg', {data: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.length).to.equal(0);
      done();

    });
  });

  it('Should run a background function with bg mode "params"', done => {
    request('POST', {}, '/bg/params/:bg', {data: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result).to.haveOwnProperty('data');
      expect(result.data).to.equal('xxx');
      done();

    });
  });

  it('Should register a runtime error properly', done => {
    request('POST', {}, '/runtime/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should register a fatal error properly', done => {
    request('POST', {}, '/runtime/fatal/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(500);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('FatalError');
      done();

    });
  });

  it('Should register a thrown error properly', done => {
    request('POST', {}, '/runtime/thrown/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should respond to an array as an implementation error', done => {
    request('POST', {}, '/runtime/array/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should respond to a boolean as an implementation error', done => {
    request('POST', {}, '/runtime/boolean/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should respond to a number as an implementation error', done => {
    request('POST', {}, '/runtime/number/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should respond to an object as an implementation error', done => {
    request('POST', {}, '/runtime/object/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should respond to a string as an implementation error', done => {
    request('POST', {}, '/runtime/string/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  after(() => FaaSGateway.close());

};
