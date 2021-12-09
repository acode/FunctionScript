const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const zlib = require('zlib');
const EventEmitter = require('events');
const xmlParser = require('fast-xml-parser');

const uuid = require('uuid');

const types = require('./types.js');
const background = require('./background.js');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const relrequire = function (pathname, name) {
  let relpath = pathname.split('/').slice(0, -1).join('/');
  let relname = name;
  if (!name.startsWith('@') && name.indexOf('/') > 0) {
    relname = path.join(process.cwd(), relpath, name);
  }
  return require(relname);
};

const DEFAULT_PORT = 8170;
const DEFAULT_NAME = 'FunctionScript.Gateway';
const DEFAULT_MAX_REQUEST_SIZE_MB = 128;
const FUNCTION_EXECUTION_TIMEOUT = 30000;

class Gateway extends EventEmitter {

  constructor (cfg) {
    super();
    cfg = cfg || {};
    this.debug = !!cfg.debug;
    this.root = cfg.root || '.';
    this.port = cfg.port || DEFAULT_PORT;
    this.name = cfg.name || DEFAULT_NAME;
    this.maxRequestSizeMB = cfg.maxRequestSizeMB || DEFAULT_MAX_REQUEST_SIZE_MB;
    this.defaultTimeout = cfg.defaultTimeout || FUNCTION_EXECUTION_TIMEOUT;
    this.supportedMethods = {'GET': true, 'POST': true, 'OPTIONS': true, 'HEAD': true};
    this.trailingSlashRedirectMethods = {'GET': true};
    this.supportedLogTypes = {'global': '***', 'info': ':::', 'error': '<!>', 'result': '>>>'};
    this.defaultLogType = 'info';
    this.supportedBgModes = background.modes;
    this.defaultBgMode = background.defaultMode;
    this.server = null;
    this.definitions = {};
    this.contextHeaders = {
      'x-authorization-keys': 'keys',
      'x-authorization-providers': 'providers'
    };
    this._inlineCache = [];
    this._requests = {};
    this._requestCount = 0;
    this._staticCache = {};
  }

  routename (req) {
    if (!req) {
      return '';
    }
    let pathname = url.parse(req.url).pathname;
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
    headers['x-functionscript'] = 'true';
    headers['access-control-expose-headers'] = Object.keys(headers).concat('x-execution-uuid').join(', ');
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
    return this.__endRequest__(
      status || 500,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'ClientError',
          message: message
        }
      })
    );
  }

  __parameterError__ (req, res, details) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      400,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'ParameterError',
          message: 'One or more parameters were invalid or missing from your request.',
          details: details
        }
      })
    );
  }

  __accessSourceError__ (req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      401,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'AccessSourceError',
          message: msg
        }
      })
    );
  }

  __accessPermissionError__ (req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      401,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'AccessPermissionError',
          message: msg
        }
      })
    );
  }

  __accessAuthError__ (req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      401,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'AccessAuthError',
          message: msg
        }
      })
    );
  }

  __accessSuspendedError__ (req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      401,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'AccessSuspendedError',
          message: msg
        }
      })
    );
  }

  __paymentRequiredError__ (req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      402,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'PaymentRequiredError',
          message: msg
        }
      })
    );
  }

  __rateLimitError__ (req, res, message, count, period) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      429,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'RateLimitError',
          message: message,
          details: {
            rate: {count, period}
          }
        }
      })
    );
  }

  __authRateLimitError__ (req, res, message, count, period) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      429,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'AuthRateLimitError',
          message: message,
          details: {
            rate: {count, period}
          }
        }
      })
    );
  }

  __unauthRateLimitError__ (req, res, message, count, period) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      429,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'UnauthRateLimitError',
          message: message,
          details: {
            rate: {count, period}
          }
        }
      })
    );
  }

  __saveError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      503,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'SaveError',
          message: msg
        }
      })
    );
  }

  __maintenanceError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      403,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'MaintenanceError',
          message: msg
        }
      })
    );
  }

  __updateError__(req, res, msg) {
    let headers = this.__createHeaders__(req, {'content-type': 'application/json'});
    return this.__endRequest__(
      409,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'UpdateError',
          message: msg
        }
      })
    );
  }

  __timeoutError__(req, res, msg, executionUuid) {
    let error = {
      type: 'TimeoutError',
      message: msg || 'Function Timeout Error'
    };
    let initialHeaders = {'content-type': 'application/json'};
    if (executionUuid) {
      initialHeaders['x-execution-uuid'] = executionUuid;
    }
    let headers = this.__createHeaders__(req, initialHeaders);
    return this.__endRequest__(
      504,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: error
      })
    );
  }

  __fatalError__ (req, res, msg, stack, executionUuid) {
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
    let initialHeaders = {'content-type': 'application/json'};
    if (executionUuid) {
      initialHeaders['x-execution-uuid'] = executionUuid;
    }
    let headers = this.__createHeaders__(req, initialHeaders);
    return this.__endRequest__(
      500,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: error
      })
    );
  }

  __runtimeError__ (req, res, msg, details, stack, executionUuid) {
    let initialHeaders = {'content-type': 'application/json'};
    if (executionUuid) {
      initialHeaders['x-execution-uuid'] = executionUuid;
    }
    let headers = this.__createHeaders__(req, initialHeaders);
    let error = {};
    error.type = 'RuntimeError';
    error.message = msg || 'Runtime Error';
    if (details) {
      error.details = details;
    }
    error.stack = stack;
    return this.__endRequest__(
      403,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({error: error})
    );
  }

  __invalidResponseHeaderError__ (req, res, details, executionUuid) {
    let initialHeaders = {'content-type': 'application/json'};
    if (executionUuid) {
      initialHeaders['x-execution-uuid'] = executionUuid;
    }
    let headers = this.__createHeaders__(req, initialHeaders);
    return this.__endRequest__(
      502,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'InvalidResponseHeaderError',
          message: 'Your service returned invalid response headers',
          details: details
        }
      })
    );
  }

  __valueError__ (req, res, details, executionUuid) {
    let initialHeaders = {'content-type': 'application/json'};
    if (executionUuid) {
      initialHeaders['x-execution-uuid'] = executionUuid;
    }
    let headers = this.__createHeaders__(req, initialHeaders);
    return this.__endRequest__(
      502,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'ValueError',
          message: 'The value returned by the function did not match the specified type',
          details: details
        }
      })
    );
  }

  __autoformatError__ (req, res, msg, details, stack, executionUuid) {
    let initialHeaders = {'content-type': 'application/json'};
    if (executionUuid) {
      initialHeaders['x-execution-uuid'] = executionUuid;
    }
    let headers = this.__createHeaders__(req, initialHeaders);
    let error = {};
    error.type = 'AutoformatError';
    error.message = msg || 'Autoformat Error';
    error.details = {
      retry: 'You can try this request again with ?raw=t set in the HTTP query parameters to see the raw file contents'
    };
    error.stack = stack;
    return this.__endRequest__(
      415,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({error: error})
    );
  }

  __complete__ (req, res, body, headers, statusCode, executionUuid) {
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = headers['content-type'] ||
      (
        Buffer.isBuffer(body)
          ? body.contentType || 'application/octet-stream'
          : 'application/json'
      );
    if (executionUuid) {
      headers['x-execution-uuid'] = executionUuid;
    }
    body = Buffer.isBuffer(body) ? body : JSON.stringify(body);
    return this.__endRequest__(
      statusCode || 200,
      this.__formatHeaders__(headers),
      req,
      res,
      body
    );
  }

  __redirect__ (req, res, location) {
    let headers = this.__createHeaders__(req, {'location': location});
    return this.__endRequest__(
      302,
      this.__formatHeaders__(headers),
      req,
      res,
      null
    );
  }

  __options__ (req, res) {
    let headers = this.__createHeaders__(req);
    return this.__endRequest__(
      200,
      this.__formatHeaders__(headers),
      req,
      res,
      null
    );
  }

  __parseParameters__ (contentType, contentTypeParameters, convert, query, buffer, definition, proxyParameters) {

    convert = !!convert;
    let params;

    if (!contentType) {
      throw new Error('Must supply "Content-Type" header');
    } else if (!buffer.length) {
      params = query;
      convert = true;
    } else if (buffer.length && Object.keys(query).length) {
      throw new Error('Can not specify both query parameters and POST data');
    } else if (contentType === 'application/x-www-form-urlencoded') {
      try {
        params = this.__parseParamsFromEncodedURL__(buffer.toString());
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
      params = this.__parseParamsFromMultipartForm__(buffer, contentType, contentTypeParameters);
    } else if (contentType === 'application/xml' || contentType === 'application/atom+xml') {
      try {
        params = this.__parseParamsFromXML__(buffer.toString());
        buffer = Buffer.from([]);
      } catch (e) {
        throw new Error('Invalid XML');
      }
    }

    let type = types.check(params);

    if (type !== 'object') {
      if (contentType === 'application/json') {
        params = {};
      } else {
        throw new Error('Invalid JSON: Must be an Object');
      }
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

    let formString = '\r\n' + formBuffer.toString('latin1')
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
            params[key] = Buffer.from(value, 'latin1');
            break;
        }

        return params;
      }, {})

    return params;

  }

  __parseParamsFromEncodedURL__ (str) {
    let rawParams = querystring.parse(str);
    return Object.keys(rawParams).reduce((params, paramName) => {
      params[paramName] = rawParams[paramName];
      return params;
    }, {});
  }

  __parseParamsFromXML__ (str) {
    let validate = true;
    let parsedData = xmlParser.parse(str, {arrayMode: false, parseNodeValue: false, ignoreAttributes : false}, validate);
    return parsedData;
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
      } else if (
        !types.validate(
          param.type, value, nullable,
          param.members ||
            (param.alternateSchemas || []).concat(param.schema ? [param.schema] : []),
          param.options && param.options.values
        )
      ) {
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
          if (param.alternateSchemas) {
            errors[param.name].expected.alternateSchemas = param.alternateSchemas;
          }
        } else if (param.members) {
          errors[param.name].expected.members = param.members
        }
      } else {
        try {
          value = types.sanitize(param.type, value, param.range);
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

  __validateResponseHeaders__ (responseHeaders) {
    let errors = {};
    let validatedHeaders = Object.keys(responseHeaders).reduce((validatedHeaders, headerName) => {
      if (typeof headerName !== 'string') {
        errors[headerName] = {
          message: `Invalid response header name "${headerName}"`,
          invalid: true
        }
      } else if (headerName.match(/\s/)) {
        errors[headerName] = {
          message: `Response header name "${headerName}" may not contain space characters`,
          invalid: true
        };
      } else if (
        typeof responseHeaders[headerName] !== 'string' &&
        typeof responseHeaders[headerName] !== 'boolean' &&
        typeof responseHeaders[headerName] !== 'number'
      ) {
        errors[headerName] = {
          message: `The value of your "${headerName}" response header is missing or invalid`,
          invalid: true
        };
      } else {
        validatedHeaders[headerName] = responseHeaders[headerName];
      }
      return validatedHeaders;
    }, {});
    return {
      headers: validatedHeaders,
      errors: Object.keys(errors).length ? errors: null
    };
  }

  __httpHandler__ (req, res) {

    req._uuid = uuid.v4();
    this._requests[req._uuid] = req;
    this._requestCount += 1;

    let urlinfo = url.parse(req.url);
    let pathinfo = urlinfo.pathname.split(':');
    let pathname = pathinfo[0];
    let pathquery = this.__parseParamsFromEncodedURL__(pathinfo[1] || '');
    req.url = [pathname, urlinfo.search].join('');

    if ('bg' in pathquery) {
      req._background = true;
      this.log(req, `Background Function Initiated`);
    }

    if (
      this.trailingSlashRedirectMethods[req.method] &&
      req.headers['user-agent'] &&
      !pathname.endsWith('/') &&
      pathname.split('/').pop().indexOf('.') === -1
    ) {
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
      size += chunk.length;
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
          if (err.accessSourceError) {
            return this.__accessSourceError__(req, res, err.message);
          } else if (err.accessPermissionError) {
            return this.__accessPermissionError__(req, res, err.message);
          } else if (err.accessAuthError) {
            return this.__accessAuthError__(req, res, err.message);
          } else if (err.accessSuspendedError) {
            return this.__accessSuspendedError__(req, res, err.message);
          } else if (err.paymentRequiredError) {
            return this.__paymentRequiredError__(req, res, err.message);
          } else if (err.rateLimitError) {
            return this.__rateLimitError__(req, res, err.message, err.rate && err.rate.count, err.rate && err.rate.period);
          } else if (err.authRateLimitError) {
            return this.__authRateLimitError__(req, res, err.message, err.rate && err.rate.count, err.rate && err.rate.period);
          } else if (err.unauthRateLimitError) {
            return this.__unauthRateLimitError__(req, res, err.message, err.rate && err.rate.count, err.rate && err.rate.period);
          } else if (err.saveError) {
            return this.__saveError__(req, res, err.message);
          } else if (err.maintenanceError) {
            return this.__maintenanceError__(req, res, err.message);
          } else if (err.updateError) {
            return this.__updateError__(req, res, err.message);
          }
          this.log(req, `ClientError: ${err.message}`, 'error');
          return this.__clientError__(req, res, err.message, err.statusCode || 400);
        }

        let [contentType, ...contentTypeParameters] = (req.method === 'GET' || req.method === 'DELETE')
          ? ['application/x-www-form-urlencoded']
          : (req.headers['content-type'] || '').split(';');

        let convert = 'x-convert-strings' in req.headers;
        let query = this.__parseParamsFromEncodedURL__(urlinfo.query);
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

        let context = this.createContext(req, definition, validated.params, data, buffer);

        let functionArgs = definition.context ?
          validated.paramsList.concat(context) :
          validated.paramsList.slice();

        data.context = context;

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

  __endRequest__ (status, headers, req, res, value) {
    if (!res.finished) {
      let bytes = null;
      if (value) {
        bytes = value;
        let contentType = headers['Content-Type'].split(';')[0];
        let acceptEncoding = req.headers['accept-encoding'];
        let canCompress = !!{
          'text/plain': 1,
          'text/html': 1,
          'text/xml': 1,
          'text/json': 1,
          'text/javascript': 1,
          'application/json': 1,
          'application/xml': 1,
          'application/atom+xml': 1,
          'application/javascript': 1,
          'application/octet-stream': 1
        }[contentType];
        if (canCompress) {
          try {
            if (acceptEncoding.match(/\bgzip\b/gi)) {
              bytes = zlib.gzipSync(bytes);
              headers['Content-Encoding'] = 'gzip';
            } else if (acceptEncoding.match(/\bdeflate\b/gi)) {
              bytes = zlib.deflateSync(bytes);
              headers['Content-Encoding'] = 'deflate';
            }
          } catch (e) {
            bytes = value;
          }
        }
        headers['Content-Length'] = Buffer.byteLength(bytes);
      }
      res.writeHead(status, headers);
      res.end(bytes);
    }
    this.end(req, value);
    delete this._requests[req._uuid];
    this._requestCount -= 1;
    !this._requestCount && this.emit('empty');
  }

  __requestHandler__ (req, res, definition, data, functionArgs, context) {
    let nullable = (definition.returns || {}).defaultValue === null;
    this.log(req, `Execution Start`);
    let t = new Date().valueOf();
    let isStatic = (
      definition.format &&
      definition.format.language &&
      definition.format.language === 'static'
    );
    this.execute(definition, functionArgs, data, (err, value, headers, executionUuid) => {
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
          return this.__runtimeError__(req, res, msg, null, null, executionUuid);
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
          return this.__runtimeError__(req, res, message, err.details, err.stack, executionUuid);
        } else if (err.timeoutError) {
          this.log(req, `Timeout Error (${dt}ms): ${err.message}`, 'error');
          return this.__timeoutError__(req, res, err.message, executionUuid);
        } else if (err.fatal) {
          this.log(req, `Fatal Error (${dt}ms): ${err.message}`, 'error');
          return this.__fatalError__(req, res, err.message, err.stack, executionUuid);
        } else {
          this.log(req, `Runtime Error (${dt}ms): ${err.message}`, 'error');
          return this.__runtimeError__(req, res, err.message, err.details, err.stack, executionUuid);
        }
      } else if (
        !types.validate(
          definition.returns.type, value, nullable,
          definition.returns.members ||
            (definition.returns.alternateSchemas || []).concat(definition.returns.schema ? [definition.returns.schema] : []),
          definition.returns.options && definition.returns.options.values
        )
      ) {
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
          if (definition.returns.alternateSchemas) {
            details.returns.expected.alternateSchemas = definition.returns.alternateSchemas;
          }
        } else if (definition.returns.members) {
          details.returns.expected.members = definition.returns.members;
        }
        this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
        return this.__valueError__(req, res, details, executionUuid);
      } else {
        try {
          value = types.sanitize(definition.returns.type, value, definition.returns.range);
        } catch (e) {
          let details = {
            returns: {
              message: e.message,
              invalid: true
            }
          };
          this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
          return this.__valueError__(req, res, details, executionUuid);
        }
        if (definition.returns.type === 'enum') {
          let member = definition.returns.members.find(m => m[0] === value);
          value = member[1];
        }
        let httpResponse;
        try {
          httpResponse = types.httpResponse(definition.returns.type, value, headers);
        } catch (e) {
          let details = {
            returns: {
              message: e.message,
              invalid: true
            }
          };
          this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
          return this.__valueError__(req, res, details, executionUuid);
        }
        if (isStatic && !functionArgs.slice().pop().params.raw) {
          try {
            httpResponse = this.__autoformat__(httpResponse);
          } catch (err) {
            this.log(req, `Autoformat Error (${dt}ms): ${err.message}`, 'error');
            return this.__autoformatError__(req, res, err.message, err.details, err.stack, executionUuid);
          }
        }
        let validated = this.__validateResponseHeaders__(httpResponse.headers);
        if (validated.errors) {
          this.log(req, `Invalid Response Header Error (${dt}ms)`, 'error');
          return this.__invalidResponseHeaderError__(req, res, validated.errors, executionUuid);
        }
        this.log(req, `Execution Complete (${dt}ms)`);
        return this.__complete__(req, res, httpResponse.body, httpResponse.headers, httpResponse.statusCode, executionUuid);
      }
    });

  }

  __autoformat__ (httpResponse) {
    return httpResponse;
  }

  findDefinition (definitions, name) {
    name = name.replace(/^\/?(.*?)\/?$/gi, '$1');
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
    let urlinfo = url.parse(req.url);
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
    try {
      context.http.json = JSON.parse(buffer.toString('utf8'));
    } catch (e) {
      context.http.json = null;
    }
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
    context = Object.keys(this.contextHeaders).reduce((context, header) => {
      let key = this.contextHeaders[header];
      context[key] = null;
      let headerValue;
      try {
        headerValue = JSON.parse(req.headers[header]);
      } catch (e) {
        headerValue = {};
      }
      context[key] = headerValue && typeof headerValue === 'object' ? headerValue : {};
      return context;
    }, context);
    context.keys = (definition.keys || []).reduce((keys, key) => {
      keys[key] = context.keys[key] || null;
      return keys;
    }, {});
    return context;
  }

  execute (definition, functionArgs, data, callback) {
    let fn;
    let complete = false;
    let callbackWrapper = (err, result, headers, executionUuid) => {
      if (!complete) {
        complete = true;
        callback(err, result, headers, executionUuid);
      }
    };
    setTimeout(() => {
      let error = new Error(`Timeout of ${this.defaultTimeout}ms exceeded.`);
      error.timeoutError = true;
      error.fatal = true;
      return callbackWrapper(error, null, null, executionUuid);
    }, this.defaultTimeout);
    let executionUuid = uuid.v4();
    if (definition.format.language === 'static') {
      let buffer = this._staticCache[definition.pathname] = (
        this._staticCache[definition.pathname] ||
        fs.readFileSync(path.join(process.cwd(), this.root, definition.pathname))
      );
      let headers = {};
      let statusCode = definition.name.endsWith(':notfound')
        ? 404
        : 200;
      let contentType = definition.metadata.contentType || 'application/octet-stream';
      if (contentType.split(';')[0].split('/')[0] === 'video') {
        let range = data.context.http.headers.range;
        let len = buffer.byteLength;
        if (range) {
          range = range
            .replace('bytes=', '')
            .split('-')
            .map(r => r.trim());
          if (!range.length) {
            range = [0, len - 1];
          } else if (range.length === 1) {
            range.push(len - 1);
          } else if (range[1] === '') {
            range[1] = len - 1;
          }
          if (range[0] === '' && !isNaN(parseInt(range[1]))) {
            range = [len - parseInt(range[1]), len - 1];
          } else {
            range = [parseInt(range[0]) || 0, parseInt(range[1]) || 0];
          }
          buffer = buffer.slice(range[0], range[1] + 1);
        } else {
          range = [0, len - 1];
        }
        if (range[0] !== 0 || range[1] !== len - 1) {
          statusCode = 206;
        }
        headers['Content-Range'] = `bytes ${range[0]}-${range[1]}/${len}`;
        headers['Accept-Ranges'] = 'bytes';
      } else if (contentType.split(';')[0].split('/')[0] === 'text') {
        contentType = contentType.split(';')[0] + '; charset=utf-8';
      }
      headers['Content-Type'] = contentType;
      headers['Content-Length'] = buffer.byteLength;
      return callbackWrapper(
        null,
        {statusCode: statusCode, headers: headers, body: buffer},
        null,
        executionUuid
      );
    } else if (definition.format.language === 'nodejs') {
      if (definition.format.inline) {
        fn = this._inlineCache[definition.pathname];
        if (!fn) {
          try {
            let fnString = fs.readFileSync(path.join(process.cwd(), this.root, definition.pathname)).toString();
            fn = new AsyncFunction('require', 'context', fnString).bind(null, relrequire.bind(null, definition.pathname));
            this._inlineCache[definition.pathname] = fn;
          } catch (e) {
            e.fatal = true;
            return callbackWrapper(e, null, null, executionUuid);
          }
        }
      } else {
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
          return callbackWrapper(e, null, null, executionUuid);
        }
      }
      // Catch unhandled promise rejections once, starting now.
      //   This applies to local testing only.
      process.removeAllListeners('unhandledRejection');
      process.once('unhandledRejection', (err, p) => callbackWrapper(err, null, null, executionUuid));
      if (definition.format.async) {
        fn.apply(null, functionArgs)
          .then(result => callbackWrapper(null, result, null, executionUuid))
          .catch(e => {
            if (!(e instanceof Error)) {
              let value = e;
              e = new Error(e || '');
              e.value = value;
            }
            e.thrown = true;
            callbackWrapper(e, null, null, executionUuid);
          });
      } else {
        try {
          fn.apply(null, functionArgs.concat((err, result, headers) => {
            return callbackWrapper(err, result, headers, executionUuid);
          }));
        } catch (e) {
          if (!(e instanceof Error)) {
            let value = e;
            e = new Error(e || '');
            e.value = value;
          }
          e.thrown = true;
          return callbackWrapper(e, null, null, executionUuid);
        }
      }
    } else {
      return callbackWrapper(new Error(`Gateway does not support language "${definition.format.language}"`))
    }
  }

  end (req, value) {
    // do nothing, response completed
    // this.log(req, value, 'result');
  }

}

module.exports = Gateway;
