const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const EventEmitter = require('events');

const uuid = require('uuid');

const types = require('./types.js');
const background = require('./background.js');

const DEFAULT_PORT = 8170;
const DEFAULT_NAME = 'FaaS Gateway';
const DEFAULT_MAX_REQUEST_SIZE_MB = 128;

class Gateway extends EventEmitter {

  constructor(cfg) {
    super();
    cfg = cfg || {};
    this.debug = !!cfg.debug;
    this.root = cfg.root || '.';
    this.port = cfg.port || DEFAULT_PORT;
    this.name = cfg.name || DEFAULT_NAME;
    this.maxRequestSizeMB = cfg.maxRequestSizeMB || DEFAULT_MAX_REQUEST_SIZE_MB;
    this.supportedMethods = {'GET': true, 'POST': true, 'OPTIONS': true};
    this.supportedLogTypes = {'global': '***', 'info': ':::', 'error': '<!>', 'result': '>>>'};
    this.defaultLogType = 'info';
    this.supportedBgModes = background.modes;
    this.defaultBgMode = background.defaultMode;
    this.server = null;
    this.definitions = {};
    this._requests = {};
    this._requestCount = 0;
  }

  routename(req) {
    if (!req) {
      return '';
    }
    let pathname = url.parse(req.url, true).pathname;
    return (req.headers.host || '') + pathname;
  }

  formatName(name) {
    return `[${name}]`;
  }

  formatRequest(req) {
    return `(${req ? [(req._background ? 'bg:' : '') + req._uuid, req.connection.remoteAddress].join(' ') : 'GLOBAL'}) ${this.routename(req)}`;
  }

  formatMessage(message, logType) {
    let prefix = logType in this.supportedLogTypes ?
      this.supportedLogTypes[logType] :
      this.supportedLogTypes[this.defaultLogType];
    return '\n' + message.split('\n').map(m => `\t${prefix} ${m}`).join('\n');
  }

  log(req, message, logType) {
    this.debug && console.log(this.formatName(this.name), this.formatRequest(req), this.formatMessage(message + '', logType));
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
    this.log(null, `Listening on port ${port}`, 'global');
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

  __background__(req, res, definition, params) {
    let bgResponse = this.supportedBgModes[definition.bg && definition.bg.mode] ||
      this.supportedBgModes[this.defaultBgMode];
    let value = bgResponse(definition, params);
    let headers = this.__createHeaders__(req);
    headers['content-type'] = headers['content-type'] ||
      (value instanceof Buffer ? 'application/octet-stream' : 'application/json');
    value = value instanceof Buffer ? value : JSON.stringify(value);
    res.finished || res.writeHead(202, headers);
    res.finished || res.end(value);
  }

  __clientError__(req, res, message, status) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(status || 500, headers);
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'ClientError',
        message: message
      }
    }));
  }

  __parameterError__(req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(400, headers);
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'ParameterError',
        message: 'One or more parameters provided did not match the function signature',
        details: details
      }
    }));
  }

  __fatalError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(500, headers);
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'FatalError',
        message: msg || 'Fatal Error',
      }
    }));
  }

  __runtimeError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(403, headers);
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'RuntimeError',
        message: msg || 'Runtime Error',
      }
    }));
  }

  __valueError__(req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(502, headers);
    return this.__endRequest__(req, res, JSON.stringify({
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
      (value instanceof Buffer ? 'application/octet-stream' : 'application/json');
    value = value instanceof Buffer ? value : JSON.stringify(value);
    let status = headers.status;
    delete headers.status;
    res.finished || res.writeHead(status || 200, headers);
    return this.__endRequest__(req, res, value);
  }

  __redirect__(req, res, location) {
    res.finished || res.writeHead(302, this.__createHeaders__(req, {'Location': location}));
    return this.__endRequest__(req, res);
  }

  __options__(req, res) {
    res.finished || res.writeHead(200, this.__createHeaders__(req));
    return this.__endRequest__(req, res);
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
      try {
        value = types.parse(param.type, value, convert);
      } catch (e) {
        value = value;
      }
      value = value === undefined ? param.defaultValue : value;
      if (value === undefined) {
        errors[param.name] = {
          message: 'required',
          required: true
        };
      } else if (!types.validate(param.type, value, nullable)) {
        let type = types.check(value);
        errors[param.name] = {
          message: `invalid value: ${Buffer.isBuffer(value) ? `Buffer[${value.length}]` : JSON.stringify(value, null, 2)} (${type}), expected (${param.type})`,
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

    req._uuid = uuid.v4();
    this._requests[req._uuid] = req;
    this._requestCount += 1;

    let urlinfo = url.parse(req.url, true);
    let pathinfo = urlinfo.pathname.split(':');
    let pathname = pathinfo[0];
    let pathquery = querystring.parse(pathinfo[1] || '');
    req.url = [pathname, urlinfo.search].join('');

    if ('bg' in pathquery) {
      req._background = true;
      this.log(req, `Background Function Initiated`);
    }

    if (req.headers['user-agent'] && !pathname.endsWith('/') && pathname.split('/').pop().indexOf('.') === -1) {
      this.log(req, `Redirect`);
      return this.__redirect__(req, res, [pathinfo.join(':'), urlinfo.search].join('/'));
    } else if (!(req.method in this.supportedMethods)) {
      this.log(req, `Not Implemented`, 'error');
      return this.__clientError__(req, res, `Not Implemented`, 501);
    } else if (req.method === 'OPTIONS') {
      this.log(req, `OPTIONS`);
      return this.__options__(req, res);
    }

    let buffers = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length
      if (size > this.maxRequestSizeMB * 1024 * 1024) {
        this.log(req, `ClientError: Function Payload Exceeded, Max Size ${this.maxRequestSizeMB}MB`, 'error');
        this.__clientError__(req, res, `Function Payload Exceeded, Max Size ${this.maxRequestSizeMB}MB`, 413);
        return req.connection.destroy();
      }
      buffers.push(chunk);
    });

    req.on('end', () => {

      if (size > this.maxRequestSizeMB * 1024 * 1024) {
        return;
      }

      let buffer = Buffer.concat(buffers);
      this.log(req, `Request Received (Size ${buffer.length})`);
      this.resolve(req, res, buffer, (err, definition, data, buffer) => {

        if (err) {
          this.log(req, `ClientError: ${err.message}`, 'error');
          return this.__clientError__(req, res, err.message, err.statusCode || 400);
        }

        let contentType = req.method === 'GET' ?
          'application/x-www-form-urlencoded' :
          (req.headers['content-type'] || '').split(';')[0];
        let convert = 'x-convert-strings' in req.headers;
        let query = urlinfo.query;
        let parsed;

        try {
          parsed = this.__parseParameters__(contentType, convert, query, buffer, definition);
        } catch (e) {
          this.log(req, `Bad Request: ${e.message}`, 'error');
          return this.__clientError__(req, res, `Bad Request: ${e.message}`, 400);
        }

        let validated = this.__validateParameters__(parsed, definition);
        if (validated.errors) {
          this.log(req, `Parameter Error`, 'error');
          return this.__parameterError__(req, res, validated.errors);
        }

        if (req._background) {
          this.log(req, `Background Function Responded to Client`);
          this.__background__(req, res, definition, validated.params);
        }

        let functionArgs = definition.context ?
          validated.paramsList.concat(this.createContext(req, definition, validated.params, data)) :
          validated.paramsList.slice();

        setImmediate(() => {
          this.__requestHandler__(
            req,
            res,
            definition,
            data,
            functionArgs
          );
        });

      });

    });

  }

  __endRequest__(req, res, value) {
    res.finished || res.end(value);
    this.end(req, value);
    delete this._requests[req._uuid];
    this._requestCount -= 1;
    !this._requestCount && this.emit('empty');
  }

  __requestHandler__(req, res, definition, data, functionArgs) {

    this.log(req, `Execution Start`);
    let t = new Date().valueOf();
    this.execute(definition, functionArgs, data, (err, value, headers) => {
      let dt = new Date().valueOf() - t;
      if (err) {
        if (err.fatal) {
          this.log(req, `Fatal Error (${dt}ms): ${err.message}`, 'error');
          return this.__fatalError__(req, res, err.message);
        } else {
          this.log(req, `Runtime Error (${dt}ms): ${err.message}`, 'error');
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
        this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
        return this.__valueError__(req, res, details);
      } else {
        this.log(req, `Execution Complete (${dt}ms)`);
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
    context.name = definition.name;
    context.alias = definition.alias;
    context.path = context.alias.split('/');
    context.params = params;
    context.remoteAddress = req.connection.remoteAddress;
    context.http = {};
    context.http.url = req.url;
    context.http.headers = req.headers;
    context.keys = null;
    context.user = null;
    context.service = null;
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

  end(req, value) {
    // do nothing, response completed
    // this.log(req, value, 'result');
  }

}

module.exports = Gateway;
