const http = require('http');
const zlib = require('zlib');
const FormData = require('form-data');
const {Gateway, FunctionParser} = require('../../index.js');

const PORT = 7357;
const HOST = 'localhost'
const ROOT = './tests/gateway';

const FaaSGateway = new Gateway({debug: false, root: ROOT});
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
      if (res.headers['content-encoding'] === 'gzip') {
        result = zlib.gunzipSync(result);
      } else if (res.headers['content-encoding'] === 'deflate') {
        result = zlib.inflateSync(result);
      }
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

  it('Should return 302 redirect on GET request when missing trailing / with user agent', done => {
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

  it('Should not return 302 redirect on a GET request when missing trailing / without user agent', done => {
    request('GET', {}, '/my_function', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.not.equal(302);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      done();

    });
  });

  it('Should not return 302 redirect for POST request with trailing slash with user agent', done => {
    request('POST', {'user-agent': 'testing'}, '/my_function', '', (err, res, result) => {

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

  it('Should give 200 OK and property headers for HEAD', done => {
    request('HEAD', {}, '/my_function/', {}, (err, res, result) => {

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

  it('Should return 200 OK + gzip result when executed with Accept-Encoding: gzip', done => {
    request('GET', {'accept-encoding': 'gzip'}, '/my_function/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-encoding']).to.equal('gzip');
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(6);
      done();

    });
  });

  it('Should return 200 OK + deflate result when executed with Accept-Encoding: deflate', done => {
    request('GET', {'accept-encoding': 'deflate'}, '/my_function/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-encoding']).to.equal('deflate');
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal(6);
      done();

    });
  });

  it('Should return 200 OK + gzip result when executed with Accept-Encoding: gzip, deflate', done => {
    request('GET', {'accept-encoding': 'gzip, deflate'}, '/my_function/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-encoding']).to.equal('gzip');
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

  it('Should not parse arguments from POST (JSON Array)', done => {
    request('POST', {}, '/my_function/', [10, 20, 30], (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ClientError');
      expect(result.error.message).to.equal('Bad Request: Invalid JSON: Must be an Object');
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
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
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

  it('Should populate HTTP body', done => {
    request('POST', {}, '/http_body/', {abc: 123}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.be.a.string;
      expect(result).to.equal('{"abc":123}');
      done();

    });
  });

  it('Should null number properly (POST)', done => {
    request('POST', {}, '/number_nullable/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.be.an.array;
      expect(result[0]).to.equal(null);
      expect(result[1]).to.equal(null);
      done();

    });
  });

  it('Should null number properly (GET)', done => {
    request('GET', {}, '/number_nullable/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.be.an.array;
      expect(result[0]).to.equal(null);
      expect(result[1]).to.equal(null);
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

  it('Should reject integer type when provided float (GET)', done => {
    request('GET', {}, '/type_rejection/?alpha=47.2', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.alpha).to.exist;
      expect(result.error.details.alpha.message).to.exist;
      expect(result.error.details.alpha.expected).to.exist;
      expect(result.error.details.alpha.expected.type).to.equal('integer');
      expect(result.error.details.alpha.actual).to.exist;
      expect(result.error.details.alpha.actual.type).to.equal('number');
      expect(result.error.details.alpha.actual.value).to.equal(47.2);
      done();

    });
  });

  it('Should reject integer type when provided float (POST)', done => {
    request('POST', {}, '/type_rejection/', {alpha: 47.2}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.alpha).to.exist;
      expect(result.error.details.alpha.message).to.exist;
      expect(result.error.details.alpha.expected).to.exist;
      expect(result.error.details.alpha.expected.type).to.equal('integer');
      expect(result.error.details.alpha.actual).to.exist;
      expect(result.error.details.alpha.actual.type).to.equal('number');
      expect(result.error.details.alpha.actual.value).to.equal(47.2);
      done();

    });
  });

  it('Should accept integer type when provided integer (GET)', done => {
    request('GET', {}, '/type_rejection/?alpha=47', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(47);
      done();

    });
  });

  it('Should accept integer type when provided integer (POST)', done => {
    request('POST', {}, '/type_rejection/', {alpha: 47}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(47);
      done();

    });
  });

  it('Should not accept empty object.http', done => {
    request('GET', {}, '/sanitize/http_object_empty/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.returns).to.exist
      expect(result.error.details.returns.invalid).to.equal(true);
      done();

    });
  });

  it('Should sanitize a {_base64: ...} buffer input', done => {
    request('GET', {}, '/sanitize/http_object_base64/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result.error).to.not.exist;
      expect(result.toString()).to.equal('fix for steven');
      done();

    });
  });

  it('Should accept uppercase Content-Type', done => {
    request('GET', {}, '/sanitize/http_object_header_case/?contentType=image/png', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.exist;
      expect(res.headers).to.haveOwnProperty('content-type');
      expect(res.headers['content-type']).to.equal('image/png');
      done();

    });
  });

  it('Should not accept object.http with null body', done => {
    request('GET', {}, '/sanitize/http_object/', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.returns).to.exist
      expect(result.error.details.returns.invalid).to.equal(true);
      done();


    });
  });

  it('Should accept object.http with string body', done => {
    request('GET', {}, '/sanitize/http_object/?body=hello', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('text/plain');
      expect(result.toString()).to.equal('hello');
      done();

    });
  });

  it('Should not accept object.http with statusCode out of range', done => {
    request('GET', {}, '/sanitize/http_object/?statusCode=600', '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.returns).to.exist
      expect(result.error.details.returns.invalid).to.equal(true);
      done();


    });
  });

  it('Should not accept object.http with invalid headers object', done => {
    request('POST', {}, '/sanitize/http_object/', {headers: true}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.returns).to.exist
      expect(result.error.details.returns.invalid).to.equal(true);
      done();


    });
  });

  it('Should allow header setting', done => {
    request('POST', {}, '/sanitize/http_object/', {body: '<b>hello</b>', headers: {'content-type': 'text/html'}}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('text/html');
      expect(result.toString()).to.equal('<b>hello</b>');
      done();

    });
  });

  it('Should overwrite access-control-allow-origin', done => {
    request('POST', {}, '/sanitize/http_object/', {body: '<b>hello</b>', headers: {'access-control-allow-origin': '$'}}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['access-control-allow-origin']).to.equal('$');
      expect(result.toString()).to.equal('<b>hello</b>');
      done();

    });
  });

  it('Should NOT overwrite x-functionscript', done => {
    request('POST', {}, '/sanitize/http_object/', {body: '<b>hello</b>', headers: {'x-functionscript': '$'}}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['x-functionscript']).to.not.equal('$');
      expect(result.toString()).to.equal('<b>hello</b>');
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

  it('Should return 302 redirect on a GET request with correct url when running a background function missing a slash before :bg and at end of url', done => {
    request('GET', {'user-agent': 'testing'}, '/bg:bg', '', (err, res, result) => {

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

  it('Should return 302 redirect on a GET request with correct url when running a background function missing a slash before :bg but with slash at end of url', done => {
    request('GET', {'user-agent': 'testing'}, '/bg:bg/', '', (err, res, result) => {

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

  it('Should return 302 redirect on a GET request with correct url when running a background function missing a slash before :bg and at end of url with a query', done => {
    request('GET', {'user-agent': 'testing'}, '/bg:bg?test=param', '', (err, res, result) => {

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

  it('Should return 302 redirect on a GET request with correct url when running a background function missing a slash before :bg but with slash at end of url with a query', done => {
    request('GET', {'user-agent': 'testing'}, '/bg:bg/?test=param', '', (err, res, result) => {

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

  it('Should run a background function with bg mode "params" looking for a specific parameter', done => {
    request('POST', {}, '/bg/paramsSpecific1/:bg', {data: 'xxx', discarded: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result).to.haveOwnProperty('data');
      expect(result).to.not.haveOwnProperty('discarded');
      expect(result.data).to.equal('xxx');
      done();

    });
  });

  it('Should run a background function with bg mode "params" looking for two specific parameters', done => {
    request('POST', {}, '/bg/paramsSpecific2/:bg', {data: 'xxx', otherdata: 'xxx', discarded: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result).to.haveOwnProperty('data');
      expect(result).to.haveOwnProperty('otherdata');
      expect(result.data).to.equal('xxx');
      expect(result.otherdata).to.equal('xxx');
      done();

    });
  });

  it('Should run a background function with bg mode "params" looking for specific param that is not there', done => {
    request('POST', {}, '/bg/paramsSpecific3/:bg', {otherdata: 'xxx'}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(202);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result).to.not.haveOwnProperty('data');
      done();

    });
  });

  it('Should register an error in the resolve step with type AccessPermissionError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('You are not allowed to access this API.');
      error.accessPermissionError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(401);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('AccessPermissionError');
      done();

    });

  });

  it('Should register an error in the resolve step with type AccessSourceError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('You are not allowed to access this API.');
      error.accessSourceError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(401);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('AccessSourceError');
      done();

    });

  });

  it('Should register an error in the resolve step with type AccessAuthError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('You are not allowed to access this API.');
      error.accessAuthError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(401);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('AccessAuthError');
      done();

    });

  });

  it('Should register an error in the resolve step with type AccessSuspendedError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('You are not allowed to access this API.');
      error.accessSuspendedError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(401);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('AccessSuspendedError');
      done();

    });

  });

  it('Should register an error in the resolve step with type PaymentRequiredError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('You are not allowed to access this API.');
      error.paymentRequiredError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(402);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('PaymentRequiredError');
      done();

    });

  });

  it('Should register an error in the resolve step with type RateLimitError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('You have called this API too many times.');
      error.rateLimitError = true;
      error.rate = {
        count: 1,
        period: 3600
      };
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(429);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('RateLimitError');
      expect(result.error.details).to.haveOwnProperty('rate');
      expect(result.error.details.rate).to.haveOwnProperty('count');
      expect(result.error.details.rate).to.haveOwnProperty('period');
      expect(result.error.details.rate.count).to.equal(1);
      expect(result.error.details.rate.period).to.equal(3600);
      done();

    });

  });

  it('Should register an error in the resolve step with type SaveError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('There was a problem when saving your API.');
      error.saveError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(503);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('SaveError');
      done();

    });

  });

  it('Should register an error in the resolve step with type MaintenanceError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('Your API is in maintenance mode.');
      error.maintenanceError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('MaintenanceError');
      done();

    });

  });

  it('Should register an error in the resolve step with type UpdateError', done => {

    let originalResolveFn = FaaSGateway.resolve;
    FaaSGateway.resolve = (req, res, buffer, callback) => {
      let error = new Error('Your API is currently updating.');
      error.updateError = true;
      return callback(error);
    };

    request('POST', {}, '/my_function/', {}, (err, res, result) => {

      FaaSGateway.resolve = originalResolveFn;

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(409);
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('UpdateError');
      done();

    });

  });

  it('Should register a runtime error properly', done => {
    request('POST', {}, '/runtime/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      expect(result.error).to.not.haveOwnProperty('details');
      done();

    });
  });

  it('Should register a runtime error properly with details', done => {
    request('POST', {}, '/runtime/details/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      expect(result.error.details).to.deep.equal({objects: 'supported'});
      done();

    });
  });

  it('Should register a fatal error properly', done => {
    request('POST', {}, '/runtime/fatal/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(500);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('FatalError');
      expect(result.error.stack).to.exist;
      done();

    });
  });

  it('Should register a fatal error with no stack properly', done => {
    request('POST', {}, '/runtime/fatal_no_stack/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(500);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('FatalError');
      expect(result.error.stack).to.not.exist;
      done();

    });
  });

  it('Should register a thrown error properly', done => {
    request('POST', {}, '/runtime/thrown/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should register an uncaught promise', done => {
    request('POST', {}, '/runtime/promise_uncaught/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(403);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
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
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
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
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
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
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
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
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
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
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result).to.be.an('object');
      expect(result.error).to.exist;
      expect(result.error).to.be.an('object');
      expect(result.error.type).to.equal('RuntimeError');
      done();

    });
  });

  it('Should handle multipart/form-data', done => {

    let form = new FormData();
    form.append('my_field', 'my value');
    form.append('my_other_field', 'my other value');

    form.submit(`http://${HOST}:${PORT}/reflect`, (err, response) => {

      expect(err).to.not.exist;
      expect(response.statusCode).to.equal(200);

      let body = [];
      response.on('readable', function() {
          body.push(response.read());
      });

      response.on('end', function() {
        let results = JSON.parse(body);
        expect(results.my_field).to.equal('my value');
        expect(results.my_other_field).to.equal('my other value');
        done();
      });

      response.on('err', function(err) {
        expect(err).to.not.exist;
        done();
      })

    })
  });

  it('Should handle multipart/form-data with buffer', done => {
    const fs = require('fs')
    let pkgJson = fs.readFileSync(process.cwd() + '/package.json')

    let form = new FormData();
    form.append('my_field', 'my value');
    form.append('my_string_buffer', Buffer.from('123'));
    form.append('my_file_buffer', pkgJson);

    form.submit(`http://${HOST}:${PORT}/reflect`, (err, response) => {

      expect(err).to.not.exist;
      expect(response.statusCode).to.equal(200);

      let body = [];
      response.on('readable', function() { body.push(response.read()); });

      response.on('end', function() {
        let results = JSON.parse(body);
        let stringBuffer = Buffer.from(results.my_string_buffer._base64, 'base64');
        let fileBuffer = Buffer.from(results.my_file_buffer._base64, 'base64');
        expect(results.my_field).to.equal('my value');
        expect(stringBuffer).to.be.deep.equal(Buffer.from('123'))
        expect(fileBuffer).to.be.deep.equal(pkgJson)
        done();
      });

      response.on('err', function(err) {
        expect(err).to.not.exist;
        done();
      })

    })
  });

  it('Should handle multipart/form-data with json', done => {

    let form = new FormData();
    form.append('my_field', 'my value');
    form.append('my_json', JSON.stringify({
      someJsonNums: 123,
      someJson: 'hello'
    }), 'my.json');

    form.submit(`http://${HOST}:${PORT}/reflect`, (err, response) => {

      expect(err).to.not.exist;
      expect(response.statusCode).to.equal(200);

      let body = [];
      response.on('readable', function() {
          body.push(response.read());
      });

      response.on('end', function() {
        let results = JSON.parse(body);
        expect(results.my_field).to.equal('my value');
        expect(results.my_json).to.deep.equal({
          someJsonNums: 123,
          someJson: 'hello'
        });
        done();
      });

      response.on('err', function(err) {
        expect(err).to.not.exist;
        done();
      })

    })
  });

  it('Should handle multipart/form-data with bad json', done => {

    let form = new FormData();
    form.append('my_field', 'my value');
    form.append('my_json', 'totally not json', 'my.json');

    form.submit(`http://${HOST}:${PORT}/reflect`, (err, response) => {

      expect(err).to.not.exist;
      expect(response.statusCode).to.equal(400);

      let body = [];
      response.on('readable', function() {
          body.push(response.read());
      });

      response.on('end', function() {
        let results = JSON.parse(body);
        expect(results.error).to.exist
        expect(results.error.message).to.equal('Bad Request: Invalid multipart form-data with key: my_json')
        done();
      });

      response.on('err', function(err) {
        expect(err).to.not.exist;
        done();
      })

    })
  });

  it('Should reject an object that doesn\'t map to Schema', done => {
    request('POST', {}, '/schema_rejection/', {
      obj: {
        name: 'hello',
        enabled: true,
        data: 'xxx',
        timestamp: 1337
      }
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.obj).to.exist;
      expect(result.error.details.obj.expected).to.exist;
      expect(result.error.details.obj.expected.type).to.equal('object');
      expect(result.error.details.obj.expected.schema).to.exist;
      expect(result.error.details.obj.expected.schema).to.have.length(4);
      expect(result.error.details.obj.expected.schema[0].name).to.equal('name');
      expect(result.error.details.obj.expected.schema[0].type).to.equal('string');
      expect(result.error.details.obj.expected.schema[1].name).to.equal('enabled');
      expect(result.error.details.obj.expected.schema[1].type).to.equal('boolean');
      expect(result.error.details.obj.expected.schema[2].name).to.equal('data');
      expect(result.error.details.obj.expected.schema[2].type).to.equal('object');
      expect(result.error.details.obj.expected.schema[2].schema).to.exist;
      expect(result.error.details.obj.expected.schema[2].schema).to.have.length(2);
      expect(result.error.details.obj.expected.schema[2].schema[0].name).to.equal('a');
      expect(result.error.details.obj.expected.schema[2].schema[0].type).to.equal('string');
      expect(result.error.details.obj.expected.schema[2].schema[1].name).to.equal('b');
      expect(result.error.details.obj.expected.schema[2].schema[1].type).to.equal('string');
      expect(result.error.details.obj.expected.schema[3].name).to.equal('timestamp');
      expect(result.error.details.obj.expected.schema[3].type).to.equal('number');
      expect(result.error.details.obj.actual).to.exist;
      expect(result.error.details.obj.actual.type).to.equal('object');
      expect(result.error.details.obj.actual.value).to.deep.equal({
        name: 'hello',
        enabled: true,
        data: 'xxx',
        timestamp: 1337
      });
      done();

    });
  });

  it('Should accept an object that correctly maps to Schema', done => {
    request('POST', {}, '/schema_rejection/', {
      obj: {
        name: 'hello',
        enabled: true,
        data: {a: 'alpha', b: 'beta'},
        timestamp: 1337
      }
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject an array that doesn\'t map to Schema', done => {
    request('POST', {}, '/schema_rejection_array/', {
      users: ['alpha', 'beta']
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.users).to.exist;
      expect(result.error.details.users.expected).to.exist;
      expect(result.error.details.users.expected.type).to.equal('array');
      expect(result.error.details.users.expected.schema).to.exist;
      expect(result.error.details.users.expected.schema).to.have.length(1);
      expect(result.error.details.users.expected.schema[0].name).to.equal('user');
      expect(result.error.details.users.expected.schema[0].type).to.equal('object');
      expect(result.error.details.users.expected.schema[0].schema).to.exist;
      expect(result.error.details.users.expected.schema[0].schema).to.have.length(2);
      expect(result.error.details.users.expected.schema[0].schema[0].name).to.equal('username');
      expect(result.error.details.users.expected.schema[0].schema[0].type).to.equal('string');
      expect(result.error.details.users.expected.schema[0].schema[1].name).to.equal('age');
      expect(result.error.details.users.expected.schema[0].schema[1].type).to.equal('number');
      expect(result.error.details.users.actual).to.exist;
      expect(result.error.details.users.actual.type).to.equal('array');
      expect(result.error.details.users.actual.value).to.deep.equal(['alpha', 'beta']);
      done();

    });
  });

  it('Should accept an array that correctly maps to Schema', done => {
    request('POST', {}, '/schema_rejection_array/', {
      users: [
        {
          username: 'alpha',
          age: 1
        },
        {
          username: 'beta',
          age: 2
        }
      ]
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject an nested array that doesn\'t map to Schema', done => {
    request('POST', {}, '/schema_rejection_nested_array/', {
      users: [
        { username: 'steve', posts: [{ title: 't', body: 'b' }] },
        { posts: [{ title: 't', body: 'b' }] }
      ]
    },
      (err, res, result) => {

        expect(err).to.not.exist;
        expect(res.statusCode).to.equal(400);
        expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
        expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
        expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
        expect(result.error).to.exist;
        expect(result.error.type).to.equal('ParameterError');
        expect(result.error.details).to.exist;
        expect(result.error.details.users).to.exist;
        expect(result.error.details.users.expected).to.exist;
        expect(result.error.details.users.expected.type).to.equal('array');
        expect(result.error.details.users.expected.schema).to.deep.equal([
          {
            name: 'user',
            type: 'object',
            description: 'a user',
            schema: [
              {
                name: 'username',
                type: 'string',
                description: ''
              },
              {
                name: 'posts',
                type: 'array',
                description: '',
                schema: [
                  {
                    name: 'post',
                    type: 'object',
                    description: '',
                    schema: [
                      {
                        name: 'title',
                        type: 'string',
                        description: ''
                      },
                      {
                        name: 'body',
                        type: 'string',
                        description: ''
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]);
        expect(result.error.details.users.actual).to.deep.equal({
          type: 'array',
          value: [
            {
              posts: [
                {
                  body: 'b',
                  title: 't'
                }
              ],
              username: 'steve'
            },
            {
              posts: [
                {
                  body: 'b',
                  title: 't'
                }
              ]
            }
          ]
        });
        done();

      });
  });

  it('Should accept a nested array that correctly maps to Schema', done => {
    request('POST', {}, '/schema_rejection_nested_array/', {
      users: [
        { username: 'steve', posts: [{ title: 't', body: 'b' }] },
        { username: 'steve2', posts: [{ title: 't', body: 'b' }] }
      ]
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.deep.equal( [
        { username: 'steve', posts: [{ title: 't', body: 'b' }] },
        { username: 'steve2', posts: [{ title: 't', body: 'b' }] }
      ]);
      done();

    });
  });

  it('Should reject an array that doesn\'t map to a Schema for an array of numbers', done => {
    request('POST', {}, '/schema_rejection_number_array/', {
      userIds: ['alpha', 'beta']
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result.error).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details.userIds).to.exist;
      expect(result.error.details.userIds.expected).to.exist;
      expect(result.error.details.userIds.expected.type).to.equal('array');
      expect(result.error.details.userIds.expected.schema).to.exist;
      expect(result.error.details.userIds.expected.schema).to.have.length(1);
      expect(result.error.details.userIds.expected.schema[0].type).to.equal('number');
      expect(result.error.details.userIds.actual).to.exist;
      expect(result.error.details.userIds.actual.type).to.equal('array');
      expect(result.error.details.userIds.actual.value).to.deep.equal(['alpha', 'beta']);
      done();

    });
  });

  it('Should accept an array that correctly maps to Schema', done => {
    request('POST', {}, '/schema_rejection_number_array/', {
      userIds: [1, 2, 3]
    },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers).to.haveOwnProperty('access-control-allow-origin');
      expect(res.headers).to.haveOwnProperty('access-control-allow-headers');
      expect(res.headers).to.haveOwnProperty('access-control-expose-headers');
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should handle large buffer parameters', done => {
    request('POST', {'x-convert-strings': true}, '/runtime/largebuffer/', {
      file: `{"_base64": "${'a'.repeat(50000000)}"}`
    }, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result.error).to.not.exist;
      done();

    });
  }).timeout(5000);

  it('Should accept a request with the optional param', done => {
    request('POST', {}, '/optional_params/', {name: 'steve'},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('steve');
      done();

    });
  });

  it('Should accept a request without the optional param', done => {
    request('POST', {}, '/optional_params/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should accept a request without the optional param', done => {
    request('POST', {}, '/schema_optional_params/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(null);
      done();

    });
  });

  it('Should accept a request without the optional param field', done => {
    request('POST', {}, '/schema_optional_params/', {obj: {name: 'steve'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.deep.equal({name: 'steve'});
      done();

    });
  });

  it('Should accept a request with the optional param field set to null', done => {
    request('POST', {}, '/schema_optional_params/', {obj: {name: 'steve', enabled: null}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.deep.equal({name: 'steve', enabled: null});
      done();

    });
  });

  it('Should accept a request with the optional param field', done => {
    request('POST', {}, '/schema_optional_params/', {obj: {name: 'steve', enabled: true}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.deep.equal({name: 'steve', enabled: true});
      done();

    });
  });

  it('Should accept a request without the optional param (nested schema)', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve' }},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.deep.equal({name: 'steve'});
      done();

    });
  });

  it('Should reject a request without the required param within the optional object (nested schema)', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve', options: {}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should accept a request with the optional object (nested schema)', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve', options: {istest: true}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({name: 'steve', options: { istest: true}});
      done();

    });
  });

  it('Should accept a request with the optional object and optional field (nested schema)', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve', options: {istest: true, threads: 4}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({name: 'steve', options: { istest: true, threads: 4}});
      done();

    });
  });

  it('Should successfully return a request without the optional value', done => {
    request('POST', {}, '/optional_nested_schema_params/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(null);
      done();

    });
  });


  it('Should successfully return a request without the optional values', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({name: 'steve'});
      done();

    });
  });

  it('Should successfully return a request with the optional values', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve', options: {istest: true}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({name: 'steve', options: {istest: true}});
      done();

    });
  });

  it('Should successfully return a request with the optional values and fields', done => {
    request('POST', {}, '/optional_nested_schema_params/', {obj: {name: 'steve', options: {istest: true, threads: 4}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({name: 'steve', options: {istest: true, threads: 4}});
      done();

    });
  });

  it('Should accept a request that matches first of two schemas', done => {
    request('POST', {}, '/object_alternate_schema/', {fileOrFolder: {name: 'test', size: 100}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.not.exist;
      expect(res.statusCode).to.equal(200);
      done();

    });
  });

  it('Should accept a request that matches second of two schemas', done => {
    request('POST', {}, '/object_alternate_schema/', {fileOrFolder: {name: 'test', files: [], options: {type: 'test'}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.not.exist;
      expect(res.statusCode).to.equal(200);
      done();

    });
  });

  it('Should accept a request that matches second subsection of two schemas', done => {
    request('POST', {}, '/object_alternate_schema/', {fileOrFolder: {name: 'test', files: [], options: {type: 100}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.not.exist;
      expect(res.statusCode).to.equal(200);
      done();

    });
  });

  it('Should reject a request that matches no schema', done => {
    request('POST', {}, '/object_alternate_schema/', {fileOrFolder: {name: 'test'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should reject a request that matches no schema based on subsection', done => {
    request('POST', {}, '/object_alternate_schema/', {fileOrFolder: {name: 'test', files: [], options: {}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should reject a request that matches no schema based on subsection type mismatch', done => {
    request('POST', {}, '/object_alternate_schema/', {fileOrFolder: {name: 'test', files: [], options: {type: false}}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should successfully return a default value with an optional field', done => {
    request('POST', {}, '/optional_param_not_null/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.equal('default');
      done();

    });
  });

  it('Should successfully return a schema with a default set to 0', done => {
    request('POST', {}, '/stripe/', {id: '0'},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      done();

    });
  });

  it('Should successfully return a schema with an array', done => {
    request('POST', {}, '/giphy/', {query: 'q'},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      done();

    });
  });

  it('Should reject a request without an proper enum member', done => {
    request('POST', {}, '/enum/', { day: 'funday' }, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result).to.exist;
      expect(result.error).to.exist;
      expect(result.error.type).to.exist;
      expect(result.error.type).to.equal('ParameterError');
      expect(result.error.details).to.exist;
      expect(result.error.details).to.deep.equal({
        day: {
          message: 'invalid value: "funday" (string), expected (enum)',
          invalid: true,
          expected: {
            type: 'enum',
            members: [
              ['sunday', 0],
              ['monday', '0'],
              ['tuesday', { a: 1, b: 2 }],
              ['wednesday', 3],
              ['thursday', [1, 2, 3]],
              ['friday', 5.4321],
              ['saturday', 6]
            ]
          },
          actual: {
            value: 'funday',
            type: 'string'
          }
        }
      });
      done();

    });
  });

  it('Should successfully return an enum variant (number)', done => {
    request('POST', {}, '/enum/', { day: 'sunday' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.equal(0);
      done();

    });
  });

  it('Should successfully return an enum variant (string)', done => {
    request('POST', {}, '/enum/', { day: 'monday' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.equal("0");
      done();

    });
  });

  it('Should successfully return an enum variant (object)', done => {
    request('POST', {}, '/enum/', { day: 'tuesday' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({a: 1, b: 2});
      done();

    });
  });


  it('Should successfully return an enum variant (array)', done => {
    request('POST', {}, '/enum/', { day: 'thursday' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal([1, 2, 3]);
      done();

    });
  });

  it('Should successfully return an enum variant (float)', done => {
    request('POST', {}, '/enum/', { day: 'friday' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.equal(5.4321);
      done();

    });
  });

  it('Should return a default enum variant', done => {
    request('POST', {}, '/enum_default/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.equal(0);
      done();

    });
  });

  it('Should return an enum using the context param', done => {
    request('POST', {}, '/enum_context/', { thingA: 'a', thingB: 'c' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({
        a: 0,
        b: {
          c: 1,
          d: [1, 2, 3]
        },
        c: '4',
        d: 5.4321
      });
      done();

    });
  });

  it('Should return an enum variant when the return type is enum', done => {
    request('POST', {}, '/enum_return/', { a: 'a' },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.equal(0);
      done();

    });
  });

  it('Should reject returning an invalid enum variant  when the return type is enum', done => {
    request('POST', {}, '/enum_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      expect(result.error).to.deep.equal({
        type: 'ValueError',
        message: 'The value returned by the function did not match the specified type',
        details: {
          returns: {
            message: 'invalid return value: "not correct" (string), expected (enum)',
            invalid: true,
            expected: {
              type: 'enum',
              members: [['a', 0], ['b', [1, 2, 3]]]
            },
            actual: {
              value: 'not correct',
              type: 'string'
            }
          }
        }
      });
      done();

    });
  });

  it('Should fail to return null from a function without a nullable return value', done => {
    request('POST', {}, '/not_nullable_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.returns).to.exist
      expect(result.error.details.returns.invalid).to.equal(true);
      done();

    });
  });

  it('Should return null from a function with a nullable return value', done => {
    request('POST', {}, '/nullable_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(null);;
      done();

    });
  });

  it('Should return a value from a function with a nullable return value', done => {
    request('POST', {}, '/nullable_return/', {a: 'hello'},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');;
      done();

    });
  });

  it('Should successfully return a default parameter after passing in null', done => {
    request('POST', {}, '/null_default_param/', {name: null},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('default');
      done();

    });
  });

  it('Should successfully return a default parameter after passing in undefined', done => {
    request('POST', {}, '/null_default_param/', {name: undefined},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('default');
      done();

    });
  });

  it('Should successfully return an object with a schema that has an enum variant', done => {
    request(
      'POST',
      {},
      '/enum_schema/',
      {
        before: 'before',
        valueRange: {
          range: 'a range',
          majorDimension: 'ROWS',
          values: []
        },
        after: 'after',
      },
      (err, res, result) => {

        expect(err).to.not.exist;
        expect(res.statusCode).to.equal(200);
        expect(result).to.exist;
        expect(result).to.deep.equal({
          range: 'a range',
          majorDimension: 'ROWS',
          values: []
        });
        done();

      }
    );
  });

  it('Should return a default enum variant set to null', done => {
    request('POST', {}, '/enum_null/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal(null);
      done();

    });
  });

  it('Should accept keyql params', done => {
    request('POST', {}, '/keyql/', { query: { name: 'steve' }, limit: { count: 0, offset: 0 }, order: { field: 'name', sort: 'ASC' } },
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should accept keyql params', done => {
    let query = JSON.stringify({ name: 'steve' });
    let limit = JSON.stringify({ count: 0, offset: 0 });
    let order = JSON.stringify({field: 'name', sort: 'ASC'});

    request('GET', {'x-convert-strings': true}, `/keyql/?query=${query}&limit=${limit}&order=${order}`, '', (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject invalid keyql limit', done => {
    request('POST', {}, '/keyql/', { query: { name: 'steve' }, limit: { count: 0, wrong: 0 }, order: { field: 'name', sort: 'ASC' }},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.limit).to.exist;
      done();

    });
  });

  it('Should reject invalid keyql order (no field)', done => {
    request('POST', {}, '/keyql/', { query: { name: 'steve' }, limit: { count: 0, offset: 0 }, order: { field: null, sort: 'ASC' }},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.order).to.exist;
      done();

    });
  });

  it('Should reject invalid keyql order (invalid sort)', done => {
    request('POST', {}, '/keyql/', { query: { name: 'steve' }, limit: { count: 0, offset: 0 }, order: { field: 'name', sort: 'WRONG' }},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.order).to.exist;
      done();

    });
  });

  it('Should reject invalid keyql order (overloaded)', done => {
    request('POST', {}, '/keyql/', { query: { name: 'steve' }, limit: { count: 0, offset: 0 }, order: { field: 'name', sort: 'ASC', wrong: 'WRONG' }},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      expect(result.error).to.exist;
      expect(result.error.details).to.exist;
      expect(result.error.details.order).to.exist;
      done();

    });
  });

  it('Should accept keyql with correct options', done => {
    request('POST', {}, '/keyql_options/', {query: {alpha: 'hello'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should accept keyql with correct options and an operator', done => {
    request('POST', {}, '/keyql_options/', {query: {alpha__is: 'hello'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject keyql with correct options with an incorrect operator', done => {
    request('POST', {}, '/keyql_options/', {query: {alpha__isnt: 'hello'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should reject keyql with incorrect options', done => {
    request('POST', {}, '/keyql_options/', {query: {gamma: 'hello'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should reject keyql with incorrect options with an operator', done => {
    request('POST', {}, '/keyql_options/', {query: {gamma__is: 'hello'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should accept keyql array with correct options', done => {
    request('POST', {}, '/keyql_options_array/', {query: [{alpha: 'hello'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should accept keyql array with correct options and an operator', done => {
    request('POST', {}, '/keyql_options_array/', {query: [{alpha__is: 'hello'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject keyql array with correct options with an incorrect operator', done => {
    request('POST', {}, '/keyql_options_array/', {query: [{alpha__isnt: 'hello'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should reject keyql array with incorrect options', done => {
    request('POST', {}, '/keyql_options_array/', {query: [{gamma: 'hello'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should reject keyql array with incorrect options with an operator', done => {
    request('POST', {}, '/keyql_options_array/', {query: [{gamma__is: 'hello'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should accept keyql order with correct options', done => {
    request('POST', {}, '/keyql_order_options/', {order: {field: 'alpha'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject keyql order with incorrect options', done => {
    request('POST', {}, '/keyql_order_options/', {order: {field: 'gamma'}},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should accept keyql array with correct options', done => {
    request('POST', {}, '/keyql_order_options_array/', {order: [{field: 'alpha'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should reject keyql array with incorrect options', done => {
    request('POST', {}, '/keyql_order_options_array/', {order: [{field: 'gamma'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should accept keyql array with all correct options', done => {
    request('POST', {}, '/keyql_order_options_array/', {order: [{field: 'alpha'}, {field: 'beta'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      done();

    });
  });

  it('Should reject keyql array with an incorrect option', done => {
    request('POST', {}, '/keyql_order_options_array/', {order: [{field: 'alpha'}, {field: 'gamma'}]},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(400);
      done();

    });
  });

  it('Should return a buffer properly', done => {
    request('POST', {}, '/buffer_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/octet-stream');
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should return a buffer properly with a .contentType set', done => {
    request('POST', {}, '/buffer_return_content_type/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('image/png');
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should return a nested buffer properly', done => {
    request('POST', {}, '/buffer_nested_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.haveOwnProperty('body');
      expect(result.body).to.haveOwnProperty('_base64');
      expect(Buffer.from(result.body._base64, 'base64').toString()).to.equal('lol');
      expect(result.test).to.exist;
      expect(result.test.deep).to.exist;
      expect(result.test.deep).to.be.an('array');
      expect(result.test.deep.length).to.equal(3);
      expect(result.test.deep[1]).to.haveOwnProperty('_base64');
      expect(Buffer.from(result.test.deep[1]._base64, 'base64').toString()).to.equal('wat');
      done();

    });
  });

  it('Should parse buffers within object params', done => {
    request('POST', {}, '/buffer_within_object_param/', {
      objectParam: {
        bufferVal: {
          _base64: 'abcde'
        }
      }
    }, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result).to.equal('ok');
      done();

    });
  });

  it('Should parse buffers within array params', done => {
    request('POST', {}, '/buffer_within_array_param/', {
      arrayParam: [{
        _base64: 'abcde'
      }]
    }, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result).to.equal('ok');
      done();

    });
  });

  it('Should return a mocked buffer as if it were a real one', done => {
    request('POST', {}, '/buffer_mocked_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should return a nested mocked buffer as if it were a real one', done => {
    request('POST', {}, '/buffer_nested_mocked_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.haveOwnProperty('body');
      expect(result.body).to.haveOwnProperty('_base64');
      expect(Buffer.from(result.body._base64, 'base64').toString()).to.equal('lol');
      expect(result.test).to.exist;
      expect(result.test.deep).to.exist;
      expect(result.test.deep).to.be.an('array');
      expect(result.test.deep.length).to.equal(3);
      expect(result.test.deep[1]).to.haveOwnProperty('_base64');
      expect(Buffer.from(result.test.deep[1]._base64, 'base64').toString()).to.equal('wat');
      done();

    });
  });

  it('Should return a mocked buffer as if it were a real one, if type "any"', done => {
    request('POST', {}, '/buffer_any_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should return a nested mocked buffer as if it were a real one, if type "any"', done => {
    request('POST', {}, '/buffer_nested_any_return/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.haveOwnProperty('body');
      expect(result.body).to.haveOwnProperty('_base64');
      expect(Buffer.from(result.body._base64, 'base64').toString()).to.equal('lol');
      expect(result.test).to.exist;
      expect(result.test.deep).to.exist;
      expect(result.test.deep).to.be.an('array');
      expect(result.test.deep.length).to.equal(3);
      expect(result.test.deep[1]).to.haveOwnProperty('_base64');
      expect(Buffer.from(result.test.deep[1]._base64, 'base64').toString()).to.equal('wat');
      done();

    });
  });

  it('Should throw an ValueError on an invalid Buffer type', done => {
    request('POST', {}, '/value_error/buffer_invalid/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      done();

    });
  });

  it('Should throw an ValueError on an invalid Number type', done => {
    request('POST', {}, '/value_error/number_invalid/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      done();

    });
  });

  it('Should throw an ValueError on an invalid Object type with alternate schema', done => {
    request('POST', {}, '/value_error/object_alternate_schema_invalid/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(502);
      expect(res.headers['x-execution-uuid'].length).to.be.greaterThan(1);
      expect(result).to.exist;
      done();

    });
  });

  it('Should not populate "context.keys" with no authorization keys header provided', done => {
    request('POST', {}, '/keys/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({
        TEST_KEY: null,
        ANOTHER_KEY: null,
        A_THIRD_KEY: null
      });
      done();

    });
  });

  it('Should not populate "context.keys" if the authorization keys header is not a serialized object', done => {
    request('POST', {
      'X-Authorization-Keys': 'stringvalue'
    }, '/keys/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({
        TEST_KEY: null,
        ANOTHER_KEY: null,
        A_THIRD_KEY: null
      });
      done();

    });
  });

  it('Should populate "context.keys" with only the proper keys', done => {
    request('POST', {
      'X-Authorization-Keys': JSON.stringify({
        TEST_KEY: '123',
        ANOTHER_KEY: 'abc',
        UNSPECIFIED_KEY: '987'
      })
    }, '/keys/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result).to.deep.equal({
        TEST_KEY: '123',
        ANOTHER_KEY: 'abc',
        A_THIRD_KEY: null
      });
      done();

    });
  });

  it('Should not populate "context.providers" with no authorization providers header provided', done => {
    request('POST', {}, '/context/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result.providers).to.deep.equal({});
      done();

    });
  });

  it('Should not populate "context.providers" if the authorization providers header is not an serialized object', done => {
    request('POST', {
      'X-Authorization-Providers': 'stringvalue'
    }, '/context/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result.providers).to.deep.equal({});
      done();

    });
  });

  it('Should populate "context.providers" as the value of the authorization providers header if it is a serialized object', done => {
    let headerValue = {
      test: {
        item: 'value'
      }
    };
    request('POST', {
      'X-Authorization-Providers': JSON.stringify(headerValue)
    }, '/context/', {},
    (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(result).to.exist;
      expect(result.providers).to.deep.equal(headerValue);
      done();

    });
  });

  it('Should populate context in "inline/context"', done => {
    request('POST', {}, '/inline/context/', {a: 1, b: 2}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result.http.method).to.equal('POST');
      expect(result.params).to.deep.equal({a: 1, b: 2});
      done();

    });
  });

  it('Should output buffer from "inline/buffer"', done => {
    request('POST', {}, '/inline/buffer/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('text/html');
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should output buffer from "inline/buffer_mock"', done => {
    request('POST', {}, '/inline/buffer_mock/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/octet-stream');
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should output buffer from "inline/http"', done => {
    request('POST', {}, '/inline/http/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(429);
      expect(res.headers['content-type']).to.equal('text/html');
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should output buffer from "inline/http_no_status"', done => {
    request('POST', {}, '/inline/http_no_status/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('text/html');
      expect(result).to.exist;
      expect(result).to.be.instanceof(Buffer);
      expect(result.toString()).to.equal('lol');
      done();

    });
  });

  it('Should output object from "inline/extended_http_is_object"', done => {
    request('POST', {}, '/inline/extended_http_is_object/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result).to.deep.equal({
        statusCode: 429,
        headers: {'Content-Type': 'text/html'},
        body: 'lol',
        extend: true
      });
      done();

    });
  });

  it('Should output object from "inline/number"', done => {
    request('POST', {}, '/inline/number/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result).to.equal(1988);
      done();

    });
  });

  it('Should allow you to use "require()"', done => {
    request('POST', {}, '/inline/require/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result).to.equal('hello');
      done();

    });
  });

  it('Should allow you to use "await"', done => {
    request('POST', {}, '/inline/await/', {}, (err, res, result) => {

      expect(err).to.not.exist;
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/json');
      expect(result).to.exist;
      expect(result).to.equal('hello world');
      done();

    });
  });

  after(() => FaaSGateway.close());

};
