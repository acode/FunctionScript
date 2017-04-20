const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const types = require('./types.js');

const DEFAULT_PORT = 8170;
const DEFAULT_NAME = 'FaaS Gateway';
const DEFAULT_MAX_REQUEST_SIZE_MB = 128;

class Gateway {

  constructor(cfg) {
    cfg = cfg || {};
    this.debug = !!cfg.debug;
    this.root = cfg.root || '.';
    this.port = cfg.port || DEFAULT_PORT;
    this.name = cfg.name || DEFAULT_NAME;
    this.maxRequestSizeMB = cfg.maxRequestSizeMB || DEFAULT_MAX_REQUEST_SIZE_MB;
    this.supportedMethods = {'GET': true, 'POST': true, 'OPTIONS': true};
    this.server = null;
    this.definitions = {};
  }

  routename(req) {
    let pathname = url.parse(req.url, true).pathname;
    return (req.headers.host || '') + pathname;
  }

  log() {
    this.debug && console.log.apply(console, [`[${this.name}]`].concat(Array.from(arguments)));
  }

  define(definitions) {
    if (!definitions || typeof definitions !== 'object') {
      throw new Error(`Definitions must be a valid object`);
    }
    return this.definitions = definitions;
  }

  listen(port) {
    port = port || this.port;
    this.server = http.createServer(this.__httpHandler__.bind(this));
    this.server.listen(port);
    this.log(`Listening on port ${port}`);
    return this.server;
  }

  close() {
    this.server && this.server.close();
    this.server = null;
    return this.server;
  }

  __createHeaders__(req, oHeaders) {
    oHeaders = oHeaders || {};
    let headers = Object.keys(oHeaders).reduce((headers, oKey) => {
      headers[oKey.toLowerCase()] = oHeaders[oKey];
      return headers;
    }, {});
    headers['access-control-allow-origin'] = headers['access-control-allow-origin'] || '*';
    headers['access-control-allow-headers'] = headers['access-control-allow-headers'] || req.headers['access-control-request-headers'] || '';
    headers['access-control-expose-headers'] = Object.keys(headers).join(', ');
    return headers;
  }

  __clientError__(req, res, message, status) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(status || 500, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'ClientError',
        message: message
      }
    }));
  }

  __parameterError__(req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(400, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'ParameterError',
        message: 'One or more parameters provided did not match the function signature',
        details: details
      }
    }));
  }

  __fatalError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(500, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'FatalError',
        message: msg || 'Fatal Error',
      }
    }));
  }

  __runtimeError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(403, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'RuntimeError',
        message: msg || 'Runtime Error',
      }
    }));
  }

  __valueError__(req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(502, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'ValueError',
        message: 'The value returned by the function did not match the specified type',
        details: details
      }
    }));
  }

  __complete__(req, res, value, headers) {
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = headers['content-type'] ||
      value instanceof Buffer ? 'application/octet-stream' : 'application/json';
    value = value instanceof Buffer ? value : JSON.stringify(value);
    let status = headers.status;
    delete headers.status;
    res.writeHead(status || 200, headers);
    return res.end(value);
  }

  __redirect__(req, res, location) {
    res.writeHead(302, this.__createHeaders__(req, {'Location': location}));
    return res.end();
  }

  __options__(req, res) {
    res.writeHead(200, this.__createHeaders__(req));
    return res.end();
  }

  __parseParameters__(contentType, convert, query, buffer, definition) {

    convert = !!convert;
    let params;

    if (!contentType) {
      throw new Error('Must Supply Content-Type');
    } else if (!buffer.length) {
      params = query;
      convert = true;
    } else if (buffer.length && Object.keys(query).length) {
      throw new Error('Can not specify query parameters and POST data');
    } else if (contentType === 'application/x-www-form-urlencoded') {
      try {
        params = querystring.parse(buffer.toString());
        buffer = new Buffer(0);
        convert = true;
      } catch (e) {
        throw new Error('Invalid URL Encoded Data');
      }
    } else if (contentType === 'application/json') {
      try {
        params = JSON.parse(buffer.toString());
        buffer = new Buffer(0);
      } catch (e) {
        throw new Error('Invalid JSON');
      }
    }

    let type = types.check(params);

    if (type === 'array') {
      params = params.reduce((params, value, i) => {
        definition.params[i] && (params[definition.params[i].name] = value);
        return params;
      }, {});
    } else if (type !== 'object') {
      throw new Error('Invalid JSON: Must be Object or Array');
    }

    return {
      params: params,
      convert: convert
    };

  }

  __validateParameters__(parsed, definition) {

    let params = parsed.params;
    let convert = parsed.convert;
    let errors = {};

    let paramsList = definition.params.map(param => {
      let nullable = param.defaultValue === null;
      let value = params[param.name];
      value = types.parse(param.type, value, convert);
      value = value === undefined ? param.defaultValue : value;
      if (value === undefined) {
        errors[param.name] = {
          message: 'required',
          required: true
        };
      } else if (!types.validate(param.type, value, nullable)) {
        let type = types.check(value);
        errors[param.name] = {
          message: `invalid value: ${Buffer.isBuffer(value) ? `Buffer[${value.length}]` :JSON.stringify(value, null, 2)} (${type}), expected (${param.type})`,
          invalid: true,
          expected: {
            type: param.type
          },
          actual: {
            value: value,
            type: type
          }
        };
      }
      return params[param.name] = value;
    });

    return {
      params: params,
      paramsList: paramsList,
      errors: Object.keys(errors).length ? errors: null
    };

  }

  __httpHandler__(req, res) {

    let urlinfo = url.parse(req.url, true);
    let routename = this.routename(req);

    if (req.headers['user-agent'] && !routename.endsWith('/') && urlinfo.pathname.split('/').pop().indexOf('.') === -1) {
      this.log(`${routename}\n::: Redirect`);
      return this.__redirect__(req, res, [urlinfo.pathname, urlinfo.search].join('/'));
    } else if (!(req.method in this.supportedMethods)) {
      this.log(`${routename}\n<!> Not Implemented`);
      return this.__clientError__(req, res, `Not Implemented`, 501);
    } else if (req.method === 'OPTIONS') {
      this.log(`${routename}\n::: OPTIONS`);
      return this.__options__(req, res);
    }

    let buffers = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length
      if (size > this.maxRequestSizeMB * 1024 * 1024) {
        this.log(`${routename}\n<!> GatewayError: Function Payload Exceeded, Max Size ${this.maxRequestSizeMB}MB`);
        return this.__clientError__(req, res, `Function Payload Exceeded, Max Size ${this.maxRequestSizeMB}MB`, 413);
      }
      buffers.push(chunk);
    });

    req.on('end', () => {

      if (size > this.maxRequestSizeMB * 1024 * 1024) {
        return;
      }

      let buffer = Buffer.concat(buffers);
      this.log(`${routename}\n::: Request Received (Size ${buffer.length})`);
      this.resolve(req, res, buffer, (err, definition, data, buffer) => {

        if (err) {
          this.log(`${routename}\n<!> GatewayError: ${err.message}`);
          return this.__clientError__(req, res, err.message, err.statusCode || 400);
        }

        this.__requestHandler__(
          req,
          res,
          definition,
          data,
          buffer
        );

      });

    });

  }

  __requestHandler__(req, res, definition, data, buffer) {

    let urlinfo = url.parse(req.url, true);
    let routename = this.routename(req);

    let contentType = req.method === 'GET' ?
      'application/x-www-form-urlencoded' :
      (req.headers['content-type'] || '').split(';')[0];
    let convert = 'x-convert-strings' in req.headers;
    let query = urlinfo.query;
    let parsed;

    try {
      parsed = this.__parseParameters__(contentType, convert, query, buffer, definition);
    } catch (e) {
      this.log(`${routename}\n<!> Bad Request: ${e.message}`);
      return this.__clientError__(req, res, `Bad Request: ${e.message}`, 400);
    }

    let validated = this.__validateParameters__(parsed, definition);
    if (validated.errors) {
      this.log(`${routename}\n<!> Parameter Error`);
      return this.__parameterError__(req, res, validated.errors);
    }

    let functionArgs = definition.context ?
      validated.paramsList.concat(this.createContext(req, definition, validated.params, data)) :
      validated.paramsList.slice();

    this.log(`${routename}\n::: Execution Start`);
    let t = new Date().valueOf();
    this.execute(definition, functionArgs, data, (err, value, headers) => {
      let dt = new Date().valueOf() - t;
      if (err) {
        if (err.fatal) {
          this.log(`${routename}\n<!> Fatal Error (${dt}ms): ${err.message}`);
          return this.__fatalError__(req, res, err.message);
        } else {
          this.log(`${routename}\n<!> Runtime Error (${dt}ms): ${err.message}`);
          return this.__runtimeError__(req, res, err.message);
        }
      } else if (!types.validate(definition.returns.type, value)) {
        let returnType = definition.returns.type;
        let type = types.check(value);
        let details = {
          returns: {
            message: `invalid return value: ${Buffer.isBuffer(value) ? `Buffer[${value.length}]` :JSON.stringify(value, null, 2)} (${type}), expected (${returnType})`,
            invalid: true,
            expected: {
              type: returnType
            },
            actual: {
              value: value,
              type: type
            }
          }
        };
        this.log(`${routename}\n<!> Value Error (${dt}ms): ${details.returns.message}`);
        return this.__valueError__(req, res, details);
      } else {
        this.log(`${routename}\n::: Execution Complete (${dt}ms)`);
        return this.__complete__(req, res, value, headers);
      }
    });

  }

  findDefinition(definitions, name) {
    name = name.replace(/^\/(.*?)\/?$/, '$1');
    let definition = definitions[name];
    if (!definition) {
      let subname = name;
      definition = definitions[`${subname}:notfound`];
      while (subname && !definition) {
        subname = subname.substr(0, subname.lastIndexOf('/'));
        definition = definitions[`${subname}:notfound`];
      }
    }
    if (!definition) {
      throw new Error(`"${name}" Not Found`);
    }
    definition.alias = name;
    return definition;
  }

  resolve(req, res, buffer, callback) {
    let urlinfo = url.parse(req.url, true);
    let pathname = urlinfo.pathname;
    let definition;
    try {
      definition = this.findDefinition(this.definitions, pathname);
    } catch (e) {
      e.statusCode = 404;
      return callback(e);
    }
    return callback(null, definition, {}, buffer);
  }

  createContext(req, definition, params, data) {
    let context = {};
    let urlinfo = url.parse(req.url, true);
    context.name = definition.name;
    context.alias = definition.alias;
    context.params = params;
    context.remoteAddress = req.connection.remoteAddress;
    context.http = {};
    context.http.headers = req.headers;
    return context;
  }

  execute(definition, functionArgs, data, callback) {
    let fn;
    try {
      let rpath = require.resolve(path.join(process.cwd(), this.root, definition.pathname));
      delete require[rpath];
      fn = require(rpath);
    } catch (e) {
      e.fatal = true;
      return callback(e);
    }
    if (definition.format.async) {
      fn.apply(null, functionArgs)
        .then(result => callback(null, result))
        .catch(err => callback(err));
    } else {
      fn.apply(null, functionArgs.concat(callback));
    }
  }

}

module.exports = Gateway;
