const http = require('http');
const {Gateway, FunctionParser} = require('../../index.js');

const PORT = 7357;
const HOST = 'localhost'
const ROOT = './tests/gateway';

const FaaSGateway = new Gateway({debug: true, root: ROOT});
const parser = new FunctionParser();

function request(method, path, data, callback) {
  method = method || 'GET';
  path = path || '';
  path = path.startsWith('/') ? path : `/${path}`;
  let headers = {};
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
    request('GET', '/', '', (err, res, result) => {

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

  it('Should return 302 redirect when missing trailing /', done => {
    request('GET', '/my_function', '', (err, res, result) => {

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

  it('Should give 200 OK and property headers for OPTIONS', done => {
    request('OPTIONS', '/my_function/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      done();

    });
  });

  it('Should return 200 OK when no Content-Type specified on GET', done => {
    request('GET', '/my_function/', undefined, (err, res, result) => {

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
    request('POST', '/my_function/', undefined, (err, res, result) => {

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
    request('GET', '/my_function/', '', (err, res, result) => {

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
    request('GET', '/my_function/?a=10&b=20&c=30', '', (err, res, result) => {

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
    request('POST', '/my_function/', 'a=10&b=20&c=30', (err, res, result) => {

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
    request('POST', '/my_function/?c=300', 'a=10&b=20&c=30', (err, res, result) => {

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
    request('POST', '/my_function/', {a: 10, b: 20, c: 30}, (err, res, result) => {

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
    request('POST', '/my_function/?c=300', {a: 10, b: 20, c: 30}, (err, res, result) => {

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
    request('POST', '/my_function/', [10, 20, 30], (err, res, result) => {

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
    request('POST', '/my_function/?c=300', [10, 20, 30], (err, res, result) => {

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
    request('POST', '/my_function/', 'a=10&b=20&c=hello%20world', (err, res, result) => {

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
    request('POST', '/my_function/', {a: 10, b: 20, c: '30'}, (err, res, result) => {

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
    request('POST', '/my_function/', {c: 100}, (err, res, result) => {

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
    request('POST', '/test/', {}, (err, res, result) => {

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
    request('POST', '/test/status/', {}, (err, res, result) => {

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

  after(() => FaaSGateway.close());

};
