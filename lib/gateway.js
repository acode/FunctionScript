const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');

const types = require('./types.js');

const DEFAULT_PORT = 8170;
const DEFAULT_NAME = 'FaaS Gateway';

class Gateway {

  constructor(cfg) {
    cfg = cfg || {};
    this.debug = !!cfg.debug;
    this.root = cfg.root || '.';
    this.port = cfg.port || DEFAULT_PORT;
    this.name = cfg.name || DEFAULT_NAME;
    this.supportedMethods = {'GET': true, 'POST': true, 'OPTIONS': true};
    this.server = null;
    this.definitions = {};
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

  __gatewayError__(req, res, message, status) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(status || 500, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'GatewayError',
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
        message: 'Parameter Error',
        details: details
      }
    }));
  }

  __functionError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(500, headers);
    return res.end(JSON.stringify({
      error: {
        type: 'FunctionError',
        message: msg || 'Function Error',
      }
    }));
  }

  __runtimeError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.writeHead(400, headers);
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
        message: 'Value Error',
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

  __parseParameters__(contentType, query, buffer, definition) {

    let params;
    let convert = false;

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
      value = convert ? types.convert(param.type, value) : value;
      value = value === undefined ? param.defaultValue : value;
      if (value === undefined) {
        errors[param.name] = {
          message: 'required',
          required: true
        };
      } else if (!types.validate(param.type, value, nullable)) {
        let type = types.check(value);
        errors[param.name] = {
          message: `invalid value: ${JSON.stringify(value)} (${type}), expected (${param.type})`,
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
    let pathname = urlinfo.pathname;

    if (!pathname.endsWith('/')) {
      this.log(`(${pathname}) :: Redirect`);
      return this.__redirect__(req, res, [pathname, urlinfo.search].join('/'));
    } else if (!(req.method in this.supportedMethods)) {
      this.log(`(${pathname}) !! Not Implemented`);
      return this.__gatewayError__(req, res, `Not Implemented`, 501);
    } else if (req.method === 'OPTIONS') {
      this.log(`(${pathname}) :: OPTIONS`);
      return this.__options__(req, res);
    }

    let buffers = [];
    req.on('data', chunk => buffers.push(chunk));

    this.resolve(req, (err, definition, data) => {

      if (err) {
        this.log(`(${pathname}) !! GatewayError: ${err.message}`);
        return this.__gatewayError__(req, res, err.message, err.statusCode || 400);
      }

      req.on('end', () =>
        this.__requestHandler__(
          req,
          res,
          definition,
          data,
          Buffer.concat(buffers)
        )
      );

    });

  }

  __requestHandler__(req, res, definition, data, buffer) {

    let urlinfo = url.parse(req.url, true);
    let pathname = urlinfo.pathname;

    this.log(`(${pathname}) :: Request Received (Size ${buffer.length})`);
    let contentType = (req.headers['content-type'] || '').split(';')[0];
    let query = urlinfo.query;
    let parsed;

    try {
      parsed = this.__parseParameters__(contentType, query, buffer, definition);
    } catch (e) {
      this.log(`(${pathname}) !! Bad Request: ${e.message}`);
      return this.__gatewayError__(req, res, `Bad Request: ${e.message}`, 400);
    }

    let validated = this.__validateParameters__(parsed, definition);
    if (validated.errors) {
      this.log(`(${pathname}) !! Parameter Error`);
      return this.__parameterError__(req, res, validated.errors);
    }

    let functionArgs = definition.context ?
      validated.paramsList.concat(this.createContext(req, validated.params, data)) :
      validated.paramsList.slice();

    this.log(`(${pathname}) :: Execution Start`);
    let t = new Date().valueOf();
    this.execute(definition, functionArgs, data, (err, value, headers) => {
      let dt = new Date().valueOf() - t;
      if (err) {
        this.log(`(${pathname}) !! Runtime Error (${dt}ms): ${err.message}`);
        return this.__runtimeError__(req, res, err.message);
      } else if (!types.validate(definition.returns.type, value)) {
        let returnType = definition.returns.type;
        let type = types.check(value);
        let details = {
          returns: {
            message: `invalid return value: ${JSON.stringify(value)} (${type}), expected (${returnType})`,
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
        this.log(`(${pathname}) !! Value Error (${dt}ms): ${details.returns.message}`);
        return this.__valueError__(req, res, details);
      } else {
        this.log(`(${pathname}) :: Execution Complete (${dt}ms)`);
        return this.__complete__(req, res, value, headers);
      }
    });

  }

  resolve(req, callback) {
    let urlinfo = url.parse(req.url, true);
    let pathname = urlinfo.pathname;
    let name = pathname.replace(/^\/(.*)\/$/, '$1');
    let definition = this.definitions[name];
    if (!definition) {
      let subname = name;
      definition = this.definitions[`${subname}:notfound`];
      while (subname && !definition) {
        subname = subname.substr(0, subname.lastIndexOf('/'));
        definition = this.definitions[`${subname}:notfound`];
      }
    }
    if (!definition) {
      let error = new Error(`"${name}" Not Found`);
      error.statusCode = 404;
      return callback(error);
    }
    return callback(null, definition, {});
  }

  createContext(req, params, data) {
    let context = {};
    context.params = params;
    context.remoteAddress = req.connection.remoteAddress;
    context.http = {};
    context.http.statusCode = req.statusCode;
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
