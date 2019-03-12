const _validations = {
  string: v => typeof v === 'string',
  number: v => typeof v === 'number' && v === v,
  float: v => parseFloat(v) === v,
  integer: v => parseInt(v) === v && v >= Number.MIN_SAFE_INTEGER && v <= Number.MAX_SAFE_INTEGER,
  boolean: v => typeof v === 'boolean',
  object: (v, schema = []) => {
    if (!!v && typeof v === 'object' && !Array.isArray(v) && !Buffer.isBuffer(v)) {
      for (let i = 0; i < schema.length; i++) {
        let param = schema[i];
        let missingParam = !v.hasOwnProperty(param.name) && !param.hasOwnProperty('defaultValue');
        let invalidParam = !validate(
          param.type,
          v[param.name] || param.defaultValue,
          param.defaultValue === null,
          param.schema
        );
        if (missingParam || invalidParam) {
          return false;
        }
      }
      return true;
    } else {
      return false;
    }
  },
  array: (v, schema = []) => {
    if (Array.isArray(v)) {
      let param = schema[0];
      if (param) {
        for (let i = 0; i < v.length; i++) {
          if (!_validations[param.type](v[i], param.schema)) {
            return false;
          }
        }
      }
      return true;
    } else {
      return false;
    }
  },
  'object.http': v => _validations.object(v),
  buffer: v => Buffer.isBuffer(v),
  any: v => true,
};

const _sanitizations = {
  'object.http': v => {
    if (!v || typeof v !== 'object') {
      return v;
    }
    let obj = {};
    obj['statusCode'] = 'statusCode' in v ? v['statusCode'] : 200;
    let oHeaders = 'headers' in v ? v['headers'] : {};
    obj['headers'] = Object.keys(oHeaders).reduce((headers, key) => {
      headers[key.toLowerCase()] = oHeaders[key];
      return headers;
    }, {});
    obj['body'] = _format.buffer(v['body']);
    if (obj['body'] === null || obj['body'] === undefined) {
      throw new Error(`Property "body" required.`);
    } else if (!_validations.string(obj['body']) && !_validations.buffer(obj['body'])) {
      throw new Error(`Property "body" must be a string or a buffer`);
    } else if (!_validations.object(obj['headers'])) {
      throw new Error(`Property "headers" must be an object.`);
    } else if (!_validations.integer(obj['statusCode']) || obj['statusCode'] < 100 || obj['statusCode'] > 599) {
      throw new Error('Property "statusCode" must be an integer and between 100 and 599.');
    }
    obj['headers']['content-type'] = obj['headers']['content-type'] ||
      (_validations.buffer(obj['body']) ? 'text/html' : 'text/plain');
    obj['body'] = _validations.buffer(obj['body']) ? obj['body'] : new Buffer(obj['body']);
    return obj;
  }
};

const _check = (v) => {
  if (v === undefined || v === null || typeof v === 'function') {
    return 'any';
  } else if (typeof v !== 'object') {
    return typeof v;
  } else {
    return Array.isArray(v) ? 'array' : (Buffer.isBuffer(v) ? 'buffer' : 'object');
  }
};

const _format = {
  string: v => v,
  number: v => v,
  float: v => v,
  integer: v => v,
  boolean: v => v,
  object: v => v,
  'object.http': v => v,
  array: v => v,
  buffer: v => {
    if (!v || typeof v !== 'object' || Buffer.isBuffer(v)) {
      return v;
    } else if (Object.keys(v).length > 1) {
      return v;
    } else if (Array.isArray(v._bytes)) {
      return new Buffer(v._bytes.map(v => Math.max(0, Math.min(255, parseInt(v)))));
    } else if (typeof v._base64 === 'string') {
      return new Buffer(v._base64, 'base64');
    } else {
      return v;
    }
  },
  any: v => v
};

const _convert = {
  string: s => s,
  number: s => {
    let v = Number(s);
    return s === null ? s : (isNaN(v) ? s : v);
  },
  float: s => {
    let v = Number(s);
    return s === null ? s : (isNaN(v) ? s : v);
  },
  integer: s => {
    let v = Number(s);
    return s === null ? s : (isNaN(v) ? s : v);
  },
  boolean: s => {
    let convert = {'t': 1, 'true': 1, 'f': 0, 'false': 0};
    s = s.trim().toLowerCase();
    return s in convert ? !!convert[s] : s;
  },
  object: s => JSON.parse(s),
  'object.http': s => JSON.parse(s),
  array: s => JSON.parse(s),
  buffer: s => {
    let o = JSON.parse(s);
    return _format.buffer(o);
  },
  any: s => s
};

const _httpResponse = {
  '': (v, headers) => {
    headers = headers || {};
    let statusCode = headers.status || 200; // legacy support
    delete headers.status;
    return {
      statusCode: statusCode,
      headers: headers,
      body: v
    };
  },
  'object.http': (v, headers) => {
    v.headers = Object.keys(v.headers || {}).reduce((headers, key) => {
      headers[key] = key.startsWith('x-')
        ? (headers[key] || v.headers[key])
        : v.headers[key];
      return headers;
    }, headers || {});
    return v;
  }
};

const validate = (type, v, nullable, schema) => (nullable && v === null) || _validations[type](v, schema);

module.exports = {
  defaultType: 'any',
  list: Object.keys(_validations),
  validate: validate,
  convert: (type, s) => _convert[type](s),
  format: (type, v) => _format[type](v),
  parse: (type, v, convert) => convert ? _format[type](_convert[type](v)) : _format[type](v),
  check: (v) => _check(v),
  sanitize: (type, v) => type in _sanitizations ? _sanitizations[type](v) : v,
  httpResponse: (type, v, headers) => type in _httpResponse ? _httpResponse[type](v, headers) : _httpResponse[''](v, headers)
};
