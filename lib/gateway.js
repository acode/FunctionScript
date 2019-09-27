const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const EventEmitter = require('events');

const uuid = require('uuid');

const types = require('./types.js');
const background = require('./background.js');

const DEFAULT_PORT = 8170;
const DEFAULT_NAME = 'FunctionScript.Gateway';
const DEFAULT_MAX_REQUEST_SIZE_MB = 128;

class Gateway extends EventEmitter {

  constructor (cfg) {
    super();
    cfg = cfg || {};
    this.debug = !!cfg.debug;
    this.root = cfg.root || '.';
    this.port = cfg.port || DEFAULT_PORT;
    this.name = cfg.name || DEFAULT_NAME;
    this.maxRequestSizeMB = cfg.maxRequestSizeMB || DEFAULT_MAX_REQUEST_SIZE_MB;
    this.supportedMethods = {'GET': true, 'POST': true, 'OPTIONS': true, 'HEAD': true};
    this.supportedLogTypes = {'global': '***', 'info': ':::', 'error': '<!>', 'result': '>>>'};
    this.defaultLogType = 'info';
    this.supportedBgModes = background.modes;
    this.defaultBgMode = background.defaultMode;
    this.server = null;
    this.definitions = {};
    this._requests = {};
    this._requestCount = 0;
  }

  routename (req) {
    if (!req) {
      return '';
    }
    let pathname = url.parse(req.url, true).pathname;
    return (req.headers.host || '') + pathname;
  }

  formatName (name) {
    return `[${name}.${process.pid}]`;
  }

  formatRequest (req) {
    return `(${req ? [(req._background ? 'bg:' : '') + req._uuid, req.connection.remoteAddress].join(' ') : 'GLOBAL'}) ${this.routename(req)}`;
  }

  formatMessage (message, logType) {
    let prefix = logType in this.supportedLogTypes ?
      this.supportedLogTypes[logType] :
      this.supportedLogTypes[this.defaultLogType];
    return '\n' + message.split('\n').map(m => `\t${prefix} ${m}`).join('\n');
  }

  log (req, message, logType) {
    this.debug && console.log(this.formatName(this.name), this.formatRequest(req), this.formatMessage(message + '', logType));
  }

  define (definitions) {
    if (!definitions || typeof definitions !== 'object') {
      throw new Error(`Definitions must be a valid object`);
    }
    return this.definitions = definitions;
  }

  listen (port, callback, opts) {
    opts = opts || {};
    this.port = port || this.port;
    this.server = http.createServer(this.__httpHandler__.bind(this));
    opts.retry && this.server.on('error', this.__retry__.bind(this));
    this.server.on('listening', this.__listening__.bind(this, callback));
    this.server.listen(this.port);
    return this.server;
  }

  __retry__ (err) {
    if (err.code === 'EADDRINUSE' && err.syscall === 'listen') {
      this.port = err.port + 1;
      this.server.close(function () {
        this.server.listen(this.port);
      }.bind(this));
    } else {
      throw err;
    }
  }

  __listening__ (callback) {
    this.log(null, `Listening on port ${this.port}`, 'global');
    (typeof callback === 'function') && callback();
  }

  close () {
    this.server && this.server.close();
    this.server = null;
    return this.server;
  }

  __formatHeaderKey__ (key) {
    return key.split('-').map(s => {
      return s.length
        ? s[0].toUpperCase() + s.substr(1).toLowerCase()
        : s;
    }).join('-');
  }

  __formatHeaders__ (oHeaders) {
    return Object.keys(oHeaders).reduce((headers, key) => {
      headers[this.__formatHeaderKey__(key)] = oHeaders[key];
      return headers;
    }, {});
  }

  __createHeaders__ (req, oHeaders) {
    oHeaders = oHeaders || {};
    let headers = Object.keys(oHeaders).reduce((headers, oKey) => {
      headers[oKey.toLowerCase()] = oHeaders[oKey];
      return headers;
    }, {});
    headers['access-control-allow-origin'] = headers['access-control-allow-origin'] || '*';
    headers['access-control-allow-headers'] = headers['access-control-allow-headers'] || req.headers['access-control-request-headers'] || '';
    headers['access-control-expose-headers'] = Object.keys(headers).join(', ');
    headers['x-functionscript'] = 'true';
    return headers;
  }

  __background__ (req, res, definition, params) {
    let bgResponse = this.supportedBgModes[definition.bg && definition.bg.mode] ||
      this.supportedBgModes[this.defaultBgMode];
    let value = bgResponse(definition, params);
    let headers = this.__createHeaders__(req);
    headers['content-type'] = headers['content-type'] ||
      (value instanceof Buffer ? 'application/octet-stream' : 'application/json');
    value = value instanceof Buffer ? value : JSON.stringify(value);
    res.finished || res.writeHead(202, this.__formatHeaders__(headers));
    res.finished || res.end(value);
  }

  __clientError__ (req, res, message, status) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(status || 500, this.__formatHeaders__(headers));
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'ClientError',
        message: message
      }
    }));
  }

  __parameterError__ (req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(400, this.__formatHeaders__(headers));
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'ParameterError',
        message: 'One or more parameters provided did not match the function signature',
        details: details
      }
    }));
  }

  __fatalError__ (req, res, msg, stack) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(500, this.__formatHeaders__(headers));
    let error = {
      type: 'FatalError',
      message: msg || 'Fatal Error'
    };
    if (stack) {
      let stackLines = stack.split('\n');
      stackLines = stackLines.slice(0, 1).concat(
        stackLines
          .slice(1)
          .filter(line => !line.match(/^\s+at\s.*?\((vm\.js|module\.js|internal\/module\.js)\:\d+\:\d+\)$/i))
      );
      error.stack = stackLines.join('\n');
    }
    return this.__endRequest__(req, res, JSON.stringify({
      error: error
    }));
  }

  __runtimeError__ (req, res, msg, stack) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(403, this.__formatHeaders__(headers));
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'RuntimeError',
        message: msg || 'Runtime Error',
        stack: stack
      }
    }));
  }

  __valueError__ (req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    res.finished || res.writeHead(502, this.__formatHeaders__(headers));
    return this.__endRequest__(req, res, JSON.stringify({
      error: {
        type: 'ValueError',
        message: 'The value returned by the function did not match the specified type',
        details: details
      }
    }));
  }

  __complete__ (req, res, body, headers, statusCode) {
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = headers['content-type'] ||
      (Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json');
    body = Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.finished || res.writeHead(statusCode || 200, this.__formatHeaders__(headers));
    return this.__endRequest__(req, res, body);
  }

  __redirect__ (req, res, location) {
    res.finished || res.writeHead(302, this.__formatHeaders__(this.__createHeaders__(req, {'location': location})));
    return this.__endRequest__(req, res);
  }

  __options__ (req, res) {
    res.finished || res.writeHead(200, this.__formatHeaders__(this.__createHeaders__(req)));
    return this.__endRequest__(req, res);
  }

  __parseParameters__ (contentType, contentTypeParameters, convert, query, buffer, definition, proxyParameters) {

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
        buffer = Buffer.from([]);
        convert = true;
      } catch (e) {
        throw new Error('Invalid URL Encoded Data');
      }
    } else if (contentType === 'application/json') {
      try {
        params = JSON.parse(buffer.toString());
        buffer = Buffer.from([]);
      } catch (e) {
        throw new Error('Invalid JSON');
      }
    } else if (contentType === 'multipart/form-data') {
      params = this.__parseParamsFromMultipartForm__(buffer, contentType, contentTypeParameters)
    }

    let type = types.check(params);

    if (type !== 'object') {
      throw new Error('Invalid JSON: Must be Object');
    }

    if (proxyParameters) {
      params = proxyParameters.reduce((combinedParams, proxyParam) => {
        combinedParams[proxyParam.name] = proxyParam.value;
        return combinedParams;
      }, params);
    }

    return {
      params: params,
      convert: convert
    };

  }

  __getMultipartFormBoundary__ (contentType) {

    let cmatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!cmatch) {
      throw new Error('Bad multipart/form-data header: no multipart boundary');
    }
    return '\r\n--' + (cmatch[1] || cmatch[2]);

  }

  __parseMultipartFormHeader__ (header, regex) {

    let hmatch = header.match(regex);
    if (!hmatch) {
      return 'text/plain';
    }

    return hmatch[1];

  }

  __parseParamsFromMultipartForm__ (formBuffer, contentType, contentTypeParameters) {

    let nameRegex = /name="([^"]*)"/;
    let contentTypeRegex = /Content-Type: ([^\s]+)*/

    let formString = '\r\n' + formBuffer.toString()
    let params = formString
      .split(this.__getMultipartFormBoundary__([contentType, ...contentTypeParameters].join(';')))
      .slice(1, -1)
      .map(part => part.split('\r\n\r\n'))
      .reduce((params, param) => {
        let [header, value] = param
        let key = this.__parseMultipartFormHeader__(header, nameRegex)
        let contentType = this.__parseMultipartFormHeader__(header, contentTypeRegex)

        switch (contentType) {
          case 'text/plain':
            params[key] = value;
            break;
          case 'application/json':
            try {
              params[key] = JSON.parse(value);
            } catch (err) {
              throw new Error(`Invalid multipart form-data with key: ${key}`)
            }
            break;
          default:
            params[key] = Buffer.from(value);
            break;
        }

        return params;
      }, {})

    return params;

  }

  __validateParameters__ (parsed, definition) {

    let params = parsed.params;
    let convert = parsed.convert;
    let errors = {};

    let paramsList = definition.params.map(param => {
      let nullable = param.defaultValue === null;
      let value = params[param.name];
      value = (value === undefined || value === null) ? param.defaultValue : value;
      try {
        value = types.parse(param.type, value, convert);
      } catch (e) {
        value = value;
      }
      if (value === undefined) {
        errors[param.name] = {
          message: 'required',
          required: true
        };
      } else if (!types.validate(param.type, value, nullable, param.schema || param.members)) {
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
        if (param.schema) {
          errors[param.name].expected.schema = param.schema;
        } else if (param.members) {
          errors[param.name].expected.members = param.members
        }
      } else {
        try {
          value = types.sanitize(param.type, value);
        } catch (e) {
          errors[param.name] = {
            message: e.message,
            invalid: true
          };
        }

        if (param.type === 'enum') {
          let member = param.members.find(m => m[0] === value);
          value = member ? member[1] : param.defaultValue;
        }
      }

      return params[param.name] = value;
    });

    return {
      params: params,
      paramsList: paramsList,
      errors: Object.keys(errors).length ? errors: null
    };

  }

  __httpHandler__ (req, res) {

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
      if (pathinfo.length === 2) {
        pathinfo[0] = pathname + '/';
        pathinfo[1] = pathinfo[1].endsWith('/') ?
          pathinfo[1].substr(0, pathinfo[1].length - 1) :
          pathinfo[1];
        return this.__redirect__(req, res, pathinfo.join(':') + (urlinfo.search || ''));
      }
      return this.__redirect__(req, res, [pathinfo.join(':'), urlinfo.search].join('/'));
    } else if (!(req.method in this.supportedMethods)) {
      this.log(req, `Not Implemented`, 'error');
      return this.__clientError__(req, res, `Not Implemented`, 501);
    } else if (req.method === 'OPTIONS' || req.method === 'HEAD') {
      this.log(req, req.method);
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
      this.resolve(req, res, buffer, (err, definition, data, buffer, proxyParameters) => {

        if (err) {
          this.log(req, `ClientError: ${err.message}`, 'error');
          return this.__clientError__(req, res, err.message, err.statusCode || 400);
        }

        let [contentType, ...contentTypeParameters] = req.method === 'GET'
          ? ['application/x-www-form-urlencoded']
          : (req.headers['content-type'] || '').split(';');

        let convert = 'x-convert-strings' in req.headers;
        let query = urlinfo.query;
        let parsed;

        try {
          parsed = this.__parseParameters__(contentType, contentTypeParameters, convert, query, buffer, definition, proxyParameters);
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
          validated.paramsList.concat(this.createContext(req, definition, validated.params, data, buffer)) :
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

  __endRequest__ (req, res, value) {
    res.finished || res.end(value);
    this.end(req, value);
    delete this._requests[req._uuid];
    this._requestCount -= 1;
    !this._requestCount && this.emit('empty');
  }

  __requestHandler__ (req, res, definition, data, functionArgs) {
    let nullable = definition.returns.defaultValue === null;
    this.log(req, `Execution Start`);
    let t = new Date().valueOf();
    this.execute(definition, functionArgs, data, (err, value, headers) => {
      let dt = new Date().valueOf() - t;
      err = err === undefined ? null : err;
      if (err !== null) {
        if (!(err instanceof Error)) {
          let jsonErr;
          try {
            jsonErr = JSON.stringify(err);
          } catch (e) {
            jsonErr = null;
          }
          let msg = `A non-error value` + (jsonErr ? ` (value: ${jsonErr}) ` : ` `) +
            `was passed to the first parameter of the execution callback() function. ` +
            `This registered as a runtime error, but is likely an implementation error. ` +
            `Use callback(new Error('description')) to pass an error, or callback(null, 'result') ` +
            `to pass a result without an error.`;
          this.log(req, `Runtime Error (${dt}ms): ${msg}`, 'error');
          return this.__runtimeError__(req, res, msg);
        } else if (err.thrown) {
          let message = err.message;
          if (err.hasOwnProperty('value')) {
            try {
              message = JSON.stringify(err.value);
            } catch (e) {
              message = '{}';
            }
          }
          this.log(req, `Runtime Error Thrown (${dt}ms): ${message}`, 'error');
          return this.__runtimeError__(req, res, message, err.stack);
        } else if (err.fatal) {
          this.log(req, `Fatal Error (${dt}ms): ${err.message}`, 'error');
          return this.__fatalError__(req, res, err.message, err.stack);
        } else {
          this.log(req, `Runtime Error (${dt}ms): ${err.message}`, 'error');
          return this.__runtimeError__(req, res, err.message, err.stack);
        }
      } else if (!types.validate(definition.returns.type, value, nullable, definition.returns.schema || definition.returns.members)) {
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
        if (definition.returns.schema) {
          details.returns.expected.schema = definition.returns.schema;
        } else if (definition.returns.members) {
          details.returns.expected.members = definition.returns.members;
        }
        this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
        return this.__valueError__(req, res, details);
      } else {
        try {
          value = types.sanitize(definition.returns.type, value);
        } catch (e) {
          let details = {
            returns: {
              message: e.message,
              invalid: true
            }
          };
          this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
          return this.__valueError__(req, res, details);
        }
        if (definition.returns.type === 'enum') {
          let member = definition.returns.members.find(m => m[0] === value);
          value = member[1];
        }
        this.log(req, `Execution Complete (${dt}ms)`);
        let httpResponse = types.httpResponse(definition.returns.type, value, headers);
        return this.__complete__(req, res, httpResponse.body, httpResponse.headers, httpResponse.statusCode);
      }
    });

  }

  findDefinition (definitions, name) {
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

  resolve (req, res, buffer, callback) {
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

  createContext (req, definition, params, data, buffer) {
    let context = {};
    context.name = definition.name;
    context.alias = definition.alias;
    context.path = context.alias.split('/');
    context.params = params;
    context.remoteAddress = req.connection.remoteAddress;
    context.http = {};
    context.http.url = req.url;
    context.http.method = req.method;
    context.http.headers = req.headers;
    context.http.body = buffer.toString('utf8');
    context.user = null;
    context.service = null;
    context.function = {
      enums: definition.params.reduce((enums, param) => {
        if (param.type === 'enum') {
          enums[param.name] = param.members.reduce((e, m) => {
            e[m[0]] = m[1];
            return e;
          }, {});
        }
        return enums;
      }, {})
    };

    let headerKeys;
    try {
      headerKeys = JSON.parse(req.headers['x-authorization-keys']);
    } catch (e) {
      headerKeys = {};
    }
    headerKeys = headerKeys && typeof headerKeys === 'object' ? headerKeys : {};
    context.keys = (definition.keys || []).reduce((keys, key) => {
      keys[key] = headerKeys[key] || null;
      return keys;
    }, {});

    return context;
  }

  execute (definition, functionArgs, data, callback) {
    let fn;
    try {
      let rpath = require.resolve(path.join(process.cwd(), this.root, definition.pathname));
      delete require[rpath];
      fn = require(rpath);
    } catch (e) {
      if (!(e instanceof Error)) {
        let value = e;
        e = new Error(e || '');
        e.value = value;
      }
      e.fatal = true;
      return callback(e);
    }
    // Catch unhandled promise rejections once, starting now.
    //   This applies to local testing only.
    process.removeAllListeners('unhandledRejection');
    process.once('unhandledRejection', (err, p) => callback(err));
    if (definition.format.async) {
      fn.apply(null, functionArgs)
        .then(result => callback(null, result))
        .catch(e => {
          if (!(e instanceof Error)) {
            let value = e;
            e = new Error(e || '');
            e.value = value;
          }
          e.thrown = true;
          callback(e);
        });
    } else {
      try {
        fn.apply(null, functionArgs.concat(callback));
      } catch (e) {
        if (!(e instanceof Error)) {
          let value = e;
          e = new Error(e || '');
          e.value = value;
        }
        e.thrown = true;
        return callback(e);
      }
    }
  }

  end (req, value) {
    // do nothing, response completed
    // this.log(req, value, 'result');
  }

}

module.exports = Gateway;
