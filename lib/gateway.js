const fs = require('fs');
const http = require('http');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const zlib = require('zlib');
const EventEmitter = require('events');
const xmlParser = require('fast-xml-parser');

const uuid = require('uuid');

const backgroundValidator = require('./background_validator.js');
const types = require('./types.js');
const wellKnowns = require('./well-knowns.js');

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
    this.supportedBackgroundModes = backgroundValidator.modes;
    this.defaultBackgroundMode = backgroundValidator.defaultMode;
    this.server = null;
    this.definitions = {};
    this.preloadFiles = {};
    this.contextHeaders = {
      'x-authorization-keys': 'keys',
      'x-authorization-providers': 'providers'
    };
    this._inlineCache = [];
    this._requests = {};
    this._requestCount = 0;
    this._staticCache = {};
    this._serverSentEvents = {};
    this._serverSentEventInterval = 100;
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

  define (definitions, preloadFiles = {}) {
    if (!definitions || typeof definitions !== 'object') {
      throw new Error(`definitions must be a valid object`);
    }
    if (!preloadFiles || typeof preloadFiles !== 'object') {
      throw new Error(`preloadFiles must be a valid object`);
    }
    this.preloadFiles = preloadFiles;
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

  __beginEmptyExecution__ (req, res) {
    let headers = this.__createHeaders__(req);
    headers['content-type'] = 'text/plain';
    let value = Buffer.from('202 accepted');
    res.headersSent || res.writeHead(202, this.__formatHeaders__(headers));
    res.finished || res.end(value);
  }

  __beginBackgroundExecution__ (req, res, definition, params, headers) {
    let bgResponse = this.supportedBackgroundModes[definition.background && definition.background.mode] ||
      this.supportedBackgroundModes[this.defaultBackgroundMode];
    let value = bgResponse(definition, params);
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = value instanceof Buffer
      ? 'text/plain'
      : 'application/json';
    value = value instanceof Buffer ? value : JSON.stringify(value);
    res.headersSent || res.writeHead(202, this.__formatHeaders__(headers));
    res.finished || res.end(value);
  }

  __beginServerSentEvent__ (req, res, definition, params, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'text/event-stream';
    res.headersSent || res.writeHead(200, this.__formatHeaders__(headers));
    // Create SSE Instance
    let sseInstance = {
      ids: {},
      sent: Buffer.from([]),
      buffer: Buffer.from([]),
    };
    sseInstance.emptyQueue = function () {
      let buffer = sseInstance.buffer;
      if (buffer.byteLength) {
        if (res && res.headersSent && !res.finished) {
          res.write(buffer);
        }
        sseInstance.sent = Buffer.concat([sseInstance.sent, buffer]);
        sseInstance.buffer = Buffer.from([]);
      }
    };
    sseInstance.interval = setInterval(() => {
      sseInstance.emptyQueue();
    }, this._serverSentEventInterval);
    sseInstance.end = function () {
      clearInterval(sseInstance.interval);
      sseInstance.interval = null;
      sseInstance.emptyQueue();
    };
    this._serverSentEvents[req._uuid] = sseInstance;
  }

  __wellKnownResponse__ (req, res, body, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      200,
      this.__formatHeaders__(headers),
      req,
      res,
      body
    );
  }

  __wellKnownError__ (req, res, message, status, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      status || 403,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'WellKnownError',
          message: message
        }
      })
    );
  }

  __clientError__ (req, res, message, status, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __parameterError__ (req, res, details, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __parameterParseError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      400,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'ParameterParseError',
          message: msg
        }
      })
    );
  }

  __originError__ (req, res, origin, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      403,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'OriginError',
          message: `Provided origin "${origin}" can not access this resource`,
        }
      })
    );
  }

  __debugError__ (req, res, message, headers) {
    headers = headers || {};
    message = message || `You do not have permission to debug this endpoint`;
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      403,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'DebugError',
          message: message,
        }
      })
    );
  }

  __executionModeError__ (req, res, mode, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      403,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'ExecutionModeError',
          message: `Execution mode "${mode}" not available for this endpoint`,
        }
      })
    );
  }

  __streamListenerError__ (req, res, details, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      400,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'StreamListenerError',
          message: 'One or more streams you specified to listen to do not exist.',
          details: details
        }
      })
    );
  }

  __accessSourceError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __accessPermissionError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __accessAuthError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __accessSuspendedError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __ownerSuspendedError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      401,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'OwnerSuspendedError',
          message: msg
        }
      })
    );
  }

  __ownerPaymentRequiredError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    return this.__endRequest__(
      401,
      this.__formatHeaders__(headers),
      req,
      res,
      JSON.stringify({
        error: {
          type: 'OwnerPaymentRequiredError',
          message: msg
        }
      })
    );
  }

  __paymentRequiredError__ (req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __rateLimitError__ (req, res, message, count, period, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __authRateLimitError__ (req, res, message, count, period, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __unauthRateLimitError__ (req, res, message, count, period, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __saveError__(req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __maintenanceError__(req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __updateError__(req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __timeoutError__(req, res, msg, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
    let error = {
      type: 'TimeoutError',
      message: msg || 'Function Timeout Error'
    };
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

  __fatalError__ (req, res, msg, stack, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __runtimeError__ (req, res, msg, details, stack, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __invalidResponseHeaderError__ (req, res, details, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __valueError__ (req, res, details, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __autoformatError__ (req, res, msg, details, stack, headers) {
    headers = headers || {};
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = 'application/json';
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

  __complete__ (req, res, body, headers, statusCode) {
    headers = this.__createHeaders__(req, headers);
    headers['content-type'] = headers['content-type'] ||
      (
        Buffer.isBuffer(body)
          ? body.contentType || 'application/octet-stream'
          : 'application/json'
      );
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
        throw e;
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
    } else if (contentType === 'text/plain') {
      // Check to see if text/plain provides valid JSON
      // This fallback is meant to handle webhooks that don't send the right
      // content-type headers -- eg vimeo
      try {
        params = JSON.parse(buffer.toString());
        if (typeof params === 'string') {
          // vimeo webhook hack
          params = JSON.parse(params);
        }
        if (params && typeof params === 'object' && !Array.isArray(params)) {
          buffer = Buffer.from([]);
          contentType = 'application/json';
        } else {
          throw new Error('Aborting "text/plain" conversion to JSON');
        }
      } catch (e) {
        // do nothing
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
    // We need to grab keys like key1[0][].key2.key3[]=5
    // Which would populate {key1:[[{key2:{key3:[5]}}]]}
    // parseKeys is to make sure bracket balancing works as expected
    let parseKeys = paramName => {
      let keys = [];
      let balancing = [];
      let curKey = '';
      for (let c = 0; c < paramName.length; c++) {
        if (paramName[c] === '[') {
          balancing.push('[');
          curKey += paramName[c];
        } else if (paramName[c] === ']') {
          balancing.pop();
          curKey += paramName[c];
        } else if (paramName[c] === '.' && !balancing.length) {
          keys.push(curKey);
          curKey = '';
        } else {
          curKey += paramName[c];
        }
      }
      keys.push(curKey);
      return keys;
    };
    let params = Object.keys(rawParams).reduce((params, paramName) => {
      let value = rawParams[paramName];
      let keys = parseKeys(paramName);
      let objectScope = params;
      for (let i = 0; i < keys.length; i++) {
        let objName = keys[i];
        let arrayMatches = objName.match(/^(.*?)((\[([^\]]*)\])+?)$/);
        if (arrayMatches) {
          let name = arrayMatches[1];
          let curObj = objectScope[name] = objectScope[name] || {
            '.type': 'Array',
            indexed: [],
            pushed: []
          };
          let indices = arrayMatches[2].slice(1, -1).split('][');
          indices.forEach((index, j) => {
            let descriptiveName = keys.slice(0, i + 1).join('.') + '[' + indices.slice(0, j + 1).join('][') + ']';
            if (curObj['.type'] !== 'Array') {
              throw new Error(`${descriptiveName}: already set, can not set as Array`);
            }
            let item = (j === indices.length - 1 && i === keys.length - 1)
              ? value
              : j === indices.length - 1
                ? {}
                : {
                    '.type': 'Array',
                    indexed: [],
                    pushed: []
                  };
            if (index) {
              let n = parseInt(index);
              if (isNaN(n) || n !== parseFloat(index)) {
                throw new Error(`${descriptiveName}: Array indices in URL encoded values must be integer values`);
              } else if (n < 0) {
                throw new Error(`${descriptiveName}: Array indices in URL encoded values must be > 0`);
              } else if (n > 65535) {
                throw new Error(`${descriptiveName}: Array indices in URL encoded values limited to 65535`);
              }
              curObj.indexed = curObj.indexed.concat(
                Array(Math.max(0, n - curObj.indexed.length)).fill(null)
              );
              curObj.indexed[n] = item;
              curObj = item;
            } else {
              curObj.pushed = curObj.pushed.concat(item);
              curObj = item;
            }
          });
          objectScope = curObj;
        } else if (i < keys.length - 1) {
          let curObj = objectScope[objName] = objectScope[objName] || {};
          if (typeof curObj !== 'object') {
            throw new Error(`${keys.slice(0, i + 1).join('.')}: can not set subfield "${keys[i + 1]}" on value "${curObj}"`);
          }
          if (curObj['.type'] === 'Array') {
            throw new Error(`${keys.slice(0, i + 1).join('.')}: already set as Array, can not set as Object`);
          }
          objectScope = curObj;
        } else if (objName in objectScope) {
          throw new Error(`${keys.slice(0, i + 1).join('.')}: already set`);
        } else {
          objectScope[objName] = value;
        }
      }
      return params;
    }, {});
    let convertArrays = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(convertArrays);
      } else if (obj && typeof obj === 'object' && obj['.type'] === 'Array') {
        return convertArrays([].concat(obj.indexed, obj.pushed));
      } else if (obj && typeof obj === 'object') {
        return Object.keys(obj).reduce((newObj, key) => {
          newObj[key] = convertArrays(obj[key]);
          return newObj;
        }, {});
      } else {
        return obj;
      }
    };
    return convertArrays(params);
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

    // Handle special parameters
    let specialParams = ['_background', '_stream', '_debug'];
    specialParams.forEach(key => {
      if (params[key]) {
        try {
          params[key] = types.parse('object', null, params[key], convert);
        } catch (e) {
          params[key] = params[key];
        }
      }
    });

    let paramsList = definition.params.map(param => {
      // Catch where there is a mismatch
      let paramMismatch = {};
      let nullable = param.defaultValue === null;
      let value = params[param.name];
      value = (value === undefined || value === null) ? param.defaultValue : value;
      try {
        value = types.parse(param.type, param.schema, value, convert);
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
          param.options && param.options.values,
          param.range,
          [param.name],
          paramMismatch
        )
      ) {
        let type = types.check(value);
        errors[param.name] = {
          message: `invalid value: ${Buffer.isBuffer(value) ? `Buffer[${value.length}]` : JSON.stringify(value, null, 2)} (${type}), expected (${param.type})`,
          invalid: true,
          mismatch: paramMismatch.stack && paramMismatch.stack.join('.'),
          expected: {
            type: param.type
          },
          actual: {
            value: value,
            type: type
          }
        };
        if (!errors[param.name].mismatch) {
          delete errors[param.name].mismatch;
        }
        if (param.schema) {
          errors[param.name].expected.schema = param.schema;
          if (param.alternateSchemas) {
            errors[param.name].expected.alternateSchemas = param.alternateSchemas;
          }
        } else if (param.members) {
          errors[param.name].expected.members = param.members
        } else if (param.options && param.options.values) {
          errors[param.name].message = `${errors[param.name].message} matching one of ${JSON.stringify(param.options.values)}`;
          errors[param.name].expected.values = param.options.values;
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

  __validateDebug__ (debugObject, streams) {
    streams = streams || [];
    debugObject = typeof debugObject === 'object'
      ? Array.isArray(debugObject) || Buffer.isBuffer(debugObject)
        ? {}
        : debugObject || {}
      : {};
    let streamObject = {};
    Object.keys(debugObject).forEach(key => {
      if (
        key === '*' ||
        key === '@begin' ||
        key === '@stdout' ||
        key === '@stderr' ||
        key === '@error'
      ) {
        return;
      } else {
        let stream = streams.find(stream => stream.name === key);
        if (!stream) {
          throw new Error(`Invalid debug listener: "${key}"`);
        } else {
          return;
        }
      }
    });
    return true;
  }

  __validateStreams__ (streamObject, streams) {
    streams = streams || [];
    streamObject = typeof streamObject === 'object'
      ? Array.isArray(streamObject) || Buffer.isBuffer(streamObject)
        ? {}
        : streamObject || {}
      : {};
    let errors = {};
    Object.keys(streamObject).forEach(key => {
      if (key === '*') {
        return;
      } else {
        let stream = streams.find(stream => stream.name === key);
        if (!stream) {
          errors[key] = {
            message: `No such stream for this function: "${key}"`,
            invalid: true
          }
        }
      }
    });
    if (Object.keys(errors).length) {
      return {valid: false, errors: errors};
    } else {
      return {valid: true};
    }
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
      } else if (headerName.match(/[^A-Za-z0-9\-_]/gi)) {
        errors[headerName] = {
          message: `Response header name "${headerName}" must only contain alphanumeric values, - and _`,
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
    req.url = [pathname, urlinfo.search].join('');

    // Legacy, will deprecate
    let pathquery;
    try {
      pathquery = this.__parseParamsFromEncodedURL__(pathinfo[1] || '');
    } catch (e) {
      return this.__parameterParseError__(req, res, e.message, 400);
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

    if ('bg' in pathquery) {
      this.log(req, `Empty Execution Initiated`);
      this.__beginEmptyExecution__(req, res);
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
          } else if (err.ownerSuspendedError) {
            return this.__ownerSuspendedError__(req, res, err.message);
          } else if (err.ownerPaymentRequiredError) {
            return this.__ownerPaymentRequiredError__(req, res, err.message);
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

        if (definition.hasOwnProperty('wellKnown')) {
          const wellKnown = definition.wellKnown;
          const definitions = definition.definitions;
          const pluginSupported = !!data.pluginSupported;
          const pluginAuthorized = !!data.pluginAuthorized;
          if (!pluginSupported) {
            return this.__wellKnownError__(req, res, `Plugin not supported for this service`, 404);
          } else if (!pluginAuthorized) {
            return this.__wellKnownError__(req, res, `Plugin access not authorized`, 403);
          }
          let plugin;
          try {
            plugin = wellKnowns.validatePlugin(data.plugin);
          } catch (e) {
            return this.__wellKnownError__(req, res, `Failed to validate plugin: ${e.message}`, 502);
          }
          const server = data.server;
          const origin = data.origin;
          const identifier = data.identifier;
          let httpResponse;
          try {
            httpResponse = wellKnowns.handlers[wellKnown](definitions, plugin, server, origin, identifier);
          } catch (e) {
            return this.__fatalError__(req, res, `Error running .well-known handler for "${wellKnown}"`, e.stack);
          }
          return this.__wellKnownResponse__(req, res, httpResponse.body, httpResponse.headers);
        }

        let headers = {};
        headers['x-execution-uuid'] = req._uuid;
        if (definition.origins) {
          if (
            req.headers['origin'] &&
            definition.origins.indexOf(req.headers['origin']) !== -1
          ) {
            headers['access-control-allow-origin'] = req.headers['origin'];
          } else {
            headers['access-control-allow-origin'] = '!';
            return this.__originError__(req, res, req.headers['origin'], headers);
          }
        }

        let [contentType, ...contentTypeParameters] = (req.method === 'GET' || req.method === 'DELETE')
          ? ['application/x-www-form-urlencoded']
          : (req.headers['content-type'] || '').split(';');

        let convert = 'x-convert-strings' in req.headers;

        let query;
        let parsed;
        try {
          query = this.__parseParamsFromEncodedURL__(urlinfo.query);
        } catch (e) {
          return this.__parameterParseError__(req, res, e.message);
        }

        try {
          parsed = this.__parseParameters__(contentType, contentTypeParameters, convert, query, buffer, definition, proxyParameters);
        } catch (e) {
          this.log(req, `Bad Request: ${e.message}`, 'error');
          return this.__parameterParseError__(req, res, e.message);
        }

        let validated = this.__validateParameters__(parsed, definition);
        if (validated.errors) {
          this.log(req, `Parameter Error`, 'error');
          return this.__parameterError__(req, res, validated.errors);
        }

        if (
          validated.params._debug === '' ||
          validated.params._debug
        ) {
          headers['x-debug'] = true;
          if (!data.canDebug) {
            this.log(req, `Debug Error`, 'error');
            return this.__debugError__(req, res, null, headers);
          } else if (
            validated.params._background === '' ||
            validated.params._background
          ) {
            this.log(req, `Debug Error`, 'error');
            return this.__debugError__(req, res, 'Can not debug with "background" mode set', headers);
          } else {
            try {
              this.__validateDebug__(validated.params._debug, definition.streams);
            } catch (e) {
              this.log(req, `Debug Error`, 'error');
              return this.__debugError__(req, res, e.message, headers);
            }
            // Set data.debug to true
            data.debug = true;
          }
        }

        if (
          validated.params._background === '' ||
          validated.params._background
        ) {
          if (!definition.background) {
            return this.__executionModeError__(req, res, 'background', headers);
          } else {
            this.log(req, `Background Function Responded to Client`);
            this.__beginBackgroundExecution__(req, res, definition, validated.params, headers);
          }
        } else if (
          validated.params._stream === '' ||
          validated.params._stream
        ) {
          if (!definition.streams || !definition.streams.length) {
            return this.__executionModeError__(req, res, 'stream', headers);
          } else {
            let streamValidated = this.__validateStreams__(validated.params._stream, definition.streams);
            if (streamValidated.errors) {
              this.log(req, `Stream Listener Error`, 'error');
              return this.__streamListenerError__(req, res, streamValidated.errors, headers);
            }
            this.log(req, `Begin Server-Sent Event`);
            this.__beginServerSentEvent__(req, res, definition, validated.params, headers);
          }
        } else if (data.debug) {
          // Always debug in stream mode
          this.__beginServerSentEvent__(req, res, definition, validated.params, headers);
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
            functionArgs,
            headers
          );
        });

      });

    });

  }

  __endRequest__ (status, headers, req, res, value) {
    if (!res.finished) {
      if (!res.headersSent) {
        // If we haven't sent headers it's a normal request
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
      } else {
        // If we have sent headers, it's a Server-Sent Event
        this.createServerSentEvent(
          req._uuid,
          -1,
          '@response',
          JSON.stringify({
            statusCode: status,
            headers: headers,
            body: Buffer.isBuffer(value)
              ? JSON.stringify({_base64: value.toString('base64')})
              : value
          })
        );
        let sseInstance = this._serverSentEvents[req._uuid];
        if (sseInstance) {
          sseInstance.end();
        }
        res.end();
      }
    }
    this.end(req, value);
    delete this._requests[req._uuid];
    delete this._serverSentEvents[req._uuid];
    this._requestCount -= 1;
    !this._requestCount && this.emit('empty');
  }

  __requestHandler__ (req, res, definition, data, functionArgs, headers) {
    let nullable = (definition.returns || {}).defaultValue === null;
    this.log(req, `Execution Start`);
    let t = new Date().valueOf();
    let isStatic = (
      definition.format &&
      definition.format.language &&
      definition.format.language === 'static'
    );
    this.execute(definition, functionArgs, data, headers, (err, value, headers, executionUuid) => {
      let dt = new Date().valueOf() - t;
      err = err === undefined ? null : err;
      // Catch where there is a mismatch
      let returnsMismatch = {};
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
          return this.__runtimeError__(req, res, msg, null, null, headers);
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
          return this.__runtimeError__(req, res, message, err.details, err.stack, headers);
        } else if (err.timeoutError) {
          this.log(req, `Timeout Error (${dt}ms): ${err.message}`, 'error');
          return this.__timeoutError__(req, res, err.message, headers);
        } else if (err.fatal) {
          this.log(req, `Fatal Error (${dt}ms): ${err.message}`, 'error');
          return this.__fatalError__(req, res, err.message, err.stack, headers);
        } else {
          this.log(req, `Runtime Error (${dt}ms): ${err.message}`, 'error');
          return this.__runtimeError__(req, res, err.message, err.details, err.stack, headers);
        }
      } else if (
        !types.validate(
          definition.returns.type, value, nullable,
          definition.returns.members ||
            (definition.returns.alternateSchemas || []).concat(definition.returns.schema ? [definition.returns.schema] : []),
          definition.returns.options && definition.returns.options.values,
          definition.returns.range,
          [definition.returns.name || '$'],
          returnsMismatch
        )
      ) {
        let returnType = definition.returns.type;
        let type = types.check(value);
        let details = {
          returns: {
            message: `invalid return value: ${Buffer.isBuffer(value) ? `Buffer[${value.length}]` :JSON.stringify(value, null, 2)} (${type}), expected (${returnType})`,
            invalid: true,
            mismatch: returnsMismatch.stack && returnsMismatch.stack.join('.'),
            expected: {
              type: returnType
            },
            actual: {
              value: value,
              type: type
            }
          }
        };
        if (!details.returns.mismatch) {
          delete details.returns.mismatch;
        }
        if (definition.returns.schema) {
          details.returns.expected.schema = definition.returns.schema;
          if (definition.returns.alternateSchemas) {
            details.returns.expected.alternateSchemas = definition.returns.alternateSchemas;
          }
        } else if (definition.returns.members) {
          details.returns.expected.members = definition.returns.members;
        }
        this.log(req, `Value Error (${dt}ms): ${details.returns.message}`, 'error');
        return this.__valueError__(req, res, details, headers);
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
          return this.__valueError__(req, res, details, headers);
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
          return this.__valueError__(req, res, details, headers);
        }
        if (isStatic && !functionArgs.slice().pop().params.raw) {
          try {
            httpResponse = this.__autoformat__(httpResponse);
          } catch (err) {
            this.log(req, `Autoformat Error (${dt}ms): ${err.message}`, 'error');
            return this.__autoformatError__(req, res, err.message, err.details, err.stack, httpResponse.headers);
          }
        }
        let validated = this.__validateResponseHeaders__(httpResponse.headers);
        if (validated.errors) {
          this.log(req, `Invalid Response Header Error (${dt}ms)`, 'error');
          return this.__invalidResponseHeaderError__(req, res, validated.errors, validated.headers);
        }
        this.log(req, `Execution Complete (${dt}ms)`);
        return this.__complete__(req, res, httpResponse.body, httpResponse.headers, httpResponse.statusCode);
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
      if (wellKnowns.handlers[name]) {
        return {
          wellKnown: name,
          definitions: definitions
        };
      } else {
        let subname = name;
        definition = definitions[`${subname}:notfound`];
        while (subname && !definition) {
          subname = subname.substr(0, subname.lastIndexOf('/'));
          definition = definitions[`${subname}:notfound`];
        }
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
    let data = {};
    data.canDebug = true;
    data.pluginSupported = true;
    data.pluginAuthorized = true;
    data.plugin = {};
    data.server = 'FunctionScript Gateway';
    data.origin = urlinfo.origin;
    data.identifier = 'service.localhost';
    return callback(null, definition, data, buffer);
  }

  createContext (req, definition, params, data, buffer) {
    let context = {};
    context.name = definition.name;
    context.alias = definition.alias;
    context.path = context.alias.split('/');
    context.params = params;
    context.remoteAddress = req.connection.remoteAddress;
    context.uuid = req._uuid;
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
    context.stream = this.__stream__.bind(this, definition.streams, context.uuid, null);
    return context;
  }

  __streamError__ (executionUuid, logId, eventName) {
    let req = this._requests[executionUuid];
    this.createServerSentEvent(
      executionUuid,
      logId,
      '@error',
      JSON.stringify({
        type: 'StreamError',
        message: [
          `No such stream "${eventName}" in function definition.`,
          ` Please use the syntax "@stream {string} name description"`,
          ` after @params to define a stream.`,
        ].join('')
      })
    );
  }

  __streamParameterError__ (executionUuid, logId, eventName, details) {
    let req = this._requests[executionUuid];
    this.log(req, `Stream Parameter Error: ${details[eventName].message}`, 'error');
    this.createServerSentEvent(
      executionUuid,
      logId,
      '@error',
      JSON.stringify({
        type: 'StreamError',
        message: [
          `Stream Parameter Error: "${eventName}".`,
          ` Please make sure the data type you are sending to the stream matches`,
          ` the definition for the stream in the function.`
        ].join(''),
        details: details
      })
    );
  }

  __stream__ (streams, executionUuid, logId, eventName, value) {
    value = value === void 0
      ? null
      : value;
    let stream = (streams || []).find(param => param.name === eventName);
    if (!stream) {
      if (
        eventName === '@begin' ||
        eventName === '@stdout' ||
        eventName === '@stderr' ||
        eventName === '@error'
      ) {
        this.createServerSentEvent(
          executionUuid,
          logId,
          eventName,
          JSON.stringify(value)
        );
      } else {
        this.__streamError__(executionUuid, logId, eventName);
      }
    } else {
      let nullable = stream.defaultValue === null;
      let details = {};
      let streamMismatch = {};
      if (
        !types.validate(
          stream.type, value, nullable,
          stream.members ||
            (stream.alternateSchemas || []).concat(stream.schema ? [stream.schema] : []),
          stream.options && stream.options.values,
          stream.range,
          [stream.name || '$'],
          streamMismatch
        )
      ) {
        let returnType = stream.type;
        let type = types.check(value);
        let details = {};
        details[eventName] = {
          message: `invalid value: ${Buffer.isBuffer(value) ? `Buffer[${value.length}]` :JSON.stringify(value, null, 2)} (${type}), expected (${returnType})`,
          invalid: true,
          mismatch: streamMismatch.stack && streamMismatch.stack.join('.'),
          expected: {
            type: returnType
          },
          actual: {
            value: value,
            type: type
          }
        };
        if (!details[eventName].mismatch) {
          delete details[eventName].mismatch;
        }
        if (stream.schema) {
          details[eventName].expected.schema = stream.schema;
          if (stream.alternateSchemas) {
            details[eventName].expected.alternateSchemas = stream.alternateSchemas;
          }
        } else if (stream.members) {
          details[eventName].expected.members = stream.members;
        }
        this.__streamParameterError__(executionUuid, logId, eventName, details);
      } else {
        try {
          value = types.sanitize(stream.type, value, stream.range);
        } catch (e) {
          let details = {};
          details[eventName] = {
            message: e.message,
            invalid: true
          };
          this.__streamParameterError__(executionUuid, logId, eventName, details);
          return;
        }
        if (stream.type === 'enum') {
          let member = stream.members.find(m => m[0] === value);
          value = member[1];
        }
        this.createServerSentEvent(
          executionUuid,
          logId,
          eventName,
          JSON.stringify(types.serialize(stream.type, value))
        );
      }
    }
  }

  createServerSentEvent (executionUuid, logId, eventName, value, silent = false, greaterThanTimestamp = null) {
    let sseInstance = this._serverSentEvents[executionUuid];
    let timestamp = new Date().toISOString();
    // Incremenet this counter so IDs don't overlap
    let i = 0;
    if (greaterThanTimestamp && timestamp <= greaterThanTimestamp) {
      let unixTimestamp = new Date(greaterThanTimestamp).valueOf();
      timestamp = new Date(unixTimestamp + 1).toISOString();
    }
    if (silent || sseInstance) {
      let printId = true;
      if (logId === -1) {
        printId = false;
        logId = null;
      }
      if (!logId) {
        let lpad = (i, len) => {
          let s = i.toString();
          return '0'.repeat(Math.max(0, len - s.length)) + s;
        };
        let endChar = timestamp[timestamp.length - 1];
        let time = timestamp.slice(0, -1);
        logId = [time, lpad(i++, 6), endChar, '/', executionUuid].join('');
        while (!silent && sseInstance.ids[logId]) {
          logId = [time, lpad(i++, 6), endChar, '/', executionUuid].join('');
        }
      }
      if (silent || !sseInstance.ids[logId]) {
        if (!silent) {
          sseInstance.ids[logId] = true;
          sseInstance.buffer = Buffer.concat([
            sseInstance.buffer,
            Buffer.from([
              printId ? `id: ${logId}\n` : '',
              eventName ? `event: ${eventName}\n` : '',
              `data: ${value}\n\n`,
            ].join(''))
          ]);
        }
        return {
          id: logId,
          timestamp: timestamp,
          name: eventName,
          payload: value
        };
      } else {
        return null
      }
    }
  }

  execute (definition, functionArgs, data, headers, callback) {
    headers = headers || {};
    let fn;
    let complete = false;
    let callbackWrapper = (err, result, headers, executionUuid) => {
      if (!complete) {
        complete = true;
        if (
          result !== null &&
          typeof result === 'object' &&
          !Buffer.isBuffer(result) &&
          typeof result.toJSON === 'function'
        ) {
          callback(err, result.toJSON(), headers, executionUuid);
        } else {
          callback(err, result, headers, executionUuid);
        }
      }
    };
    setTimeout(() => {
      let error = new Error(`Timeout of ${this.defaultTimeout}ms exceeded.`);
      error.timeoutError = true;
      error.fatal = true;
      return callbackWrapper(error, null, headers, executionUuid);
    }, this.defaultTimeout);
    let executionUuid = data.context.uuid || uuid.v4();
    if (definition.format.language === 'static') {
      let buffer = this._staticCache[definition.pathname] = (
        this._staticCache[definition.pathname] ||
        this.preloadFiles[definition.pathname] ||
        fs.readFileSync(path.join(process.cwd(), this.root, definition.pathname))
      );
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
        headers,
        executionUuid
      );
    } else if (definition.format.language === 'nodejs') {
      if (definition.format.inline) {
        fn = this._inlineCache[definition.pathname];
        if (!fn) {
          try {
            let fnString;
            if (this.preloadFiles[definition.pathname]) {
              fnString = this.preloadFiles[definition.pathname].toString();
            } else {
              fnString = fs.readFileSync(path.join(process.cwd(), this.root, definition.pathname)).toString();
            }
            fn = new AsyncFunction('require', 'context', fnString).bind(null, relrequire.bind(null, definition.pathname));
            this._inlineCache[definition.pathname] = fn;
          } catch (e) {
            e.fatal = true;
            return callbackWrapper(e, null, headers, executionUuid);
          }
        }
      } else {
        try {
          let pathname = definition.pathname;
          let rpath;
          if (this.preloadFiles[pathname]) {
            let filename = path.join(process.cwd(), pathname);
            if (fs.existsSync(filename)) {
              throw new Error(`Preloaded file "${pathname}" conflicts with existing file`);
            }
            let pathList = filename.split(path.sep);
            let addedDirs = [];
            for (let i = 1; i < pathList.length - 1; i++) {
              let checkPath = pathList.slice(0, i + 1).join(path.sep);
              if (fs.existsSync(checkPath)) {
                let stat = fs.statSync(checkPath);
                if (!stat.isDirectory()) {
                  throw new Error(`Preloaded file "${pathname}" can not be created, "${checkPath}" is not a directory`);
                }
              } else {
                addedDirs.push(checkPath);
                try {
                  fs.mkdirSync(checkPath);
                } catch (e) {
                  throw new Error(`Preloaded file "${pathname}" can not be created, "${checkPath}" could not be written`);
                }
              }
            }
            fs.writeFileSync(filename, this.preloadFiles[pathname]);
            rpath = require.resolve(filename);
            delete require[rpath];
            fn = require(rpath);
            fs.unlinkSync(filename);
            while (addedDirs.length) {
              fs.rmdirSync(addedDirs.pop());
            }
          } else {
            rpath = require.resolve(path.join(process.cwd(), this.root, definition.pathname));
            delete require[rpath];
            fn = require(rpath);
          }
        } catch (e) {
          if (!(e instanceof Error)) {
            let value = e;
            e = new Error(e || '');
            e.value = value;
          }
          e.fatal = true;
          return callbackWrapper(e, null, headers, executionUuid);
        }
      }
      // Overwrite internal console to stream output
      const stringifyArgs = args => {
        return args.map(arg => {
          return (typeof arg === 'string')
            ? arg
            : JSON.stringify(arg)
        }).join(' ');
      };
      let console = global.console;
      if (data.debug) {
        let gConsole = {};
        Object.keys(console).forEach(key => {
          let fn = console[key];
          if (typeof fn === 'function') {
            gConsole[key] = console[key].bind(console);
          } else {
            gConsole[key] = console[key];
          }
        });
        gConsole.log = function () {
          let args = [].slice.call(arguments);
          console.log(...args);
          data.context.stream('@stdout', stringifyArgs(args));
        };
        gConsole.error = function () {
          let args = [].slice.call(arguments);
          console.error(...args);
          data.context.stream('@stderr', stringifyArgs(args));
        };
        global.console = gConsole;
      }
      // Catch unhandled promise rejections once, starting now.
      //   This applies to local testing only.
      process.removeAllListeners('unhandledRejection');
      process.once('unhandledRejection', (err, p) => {
        global.console = console;
        callbackWrapper(err, null, headers, executionUuid);
      });
      data.context.stream('@begin', new Date().toISOString());
      if (definition.format.async) {
        fn.apply(null, functionArgs)
          .then(result => {
            global.console = console;
            callbackWrapper(null, result, headers, executionUuid);
          })
          .catch(e => {
            if (!(e instanceof Error)) {
              let value = e;
              e = new Error(e || '');
              e.value = value;
            }
            e.thrown = true;
            global.console = console;
            callbackWrapper(e, null, headers, executionUuid);
          });
      } else {
        try {
          fn.apply(null, functionArgs.concat((err, result, responseHeaders) => {
            Object.keys(responseHeaders || {}).forEach(key => {
              headers[key.toLowerCase()] = responseHeaders[key];
            });
            global.console = console;
            return callbackWrapper(err, result, headers, executionUuid);
          }));
        } catch (e) {
          if (!(e instanceof Error)) {
            let value = e;
            e = new Error(e || '');
            e.value = value;
          }
          e.thrown = true;
          global.console = console;
          return callbackWrapper(e, null, headers, executionUuid);
        }
      }
    } else {
      return callbackWrapper(
        new Error(`Gateway does not support language "${definition.format.language}"`),
        null,
        headers,
        executionUuid
      );
    }
  }

  end (req, value) {
    // do nothing, response completed
    // this.log(req, value, 'result');
  }

}

module.exports = Gateway;
