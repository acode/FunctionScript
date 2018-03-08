const http = require('http');
const FormData = require('form-data');
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

  it('Should register an uncaught promise', done => {
    request('POST', {}, '/runtime/promise_uncaught/', {}, (err, res, result) => {

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
      response.on('readable', function() {
          body.push(response.read());
      });

      response.on('end', function() {
        let results = JSON.parse(body);
        let stringBuffer = Buffer.from(results.my_string_buffer.data)
        let fileBuffer = Buffer.from(results.my_file_buffer.data)
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

  after(() => FaaSGateway.close());

};
