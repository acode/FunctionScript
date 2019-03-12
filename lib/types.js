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
        if (!v.hasOwnProperty(param.name) || !_validations[param.type](v[param.name], param.schema)) {
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

const _mergeSchemas = (type, schema1, schema2) => {
  if (!schema1 || !schema2) {
    return null;
  }
  if (type === 'array') {
    let commonType = schema1[0].type === schema2[0].type ? schema1[0].type : 'any';
    if (commonType === 'array' || commonType === 'object') {
      return [{
        type: commonType,
        schema: _mergeSchemas(commonType, schema1[0].schema, schema2[0].schema)
      }];
    } else {
      return [{
        type: commonType
      }];
    }
  } else if (type === 'object') {
    return schema1.reduce((mergedSchema, s1) => {
      let match = schema2.find((s2) => {
        return s1.name === s2.name;
      });
      if (!!match) {
        let commonType = s1.type === match.type ? s1.type : 'any';
        let merged = {
          name: s1.name,
          type: commonType
        };
        if (s1.nullable || match.nullable) {
          merged.nullable = true;
        }
        if (commonType === 'array' || commonType === 'object') {
          merged.schema = _mergeSchemas(commonType, s1.schema, match.schema);
        } else {
          merged.sampleValue = s1.sampleValue;
        }
        mergedSchema.push(merged);
      }
      return mergedSchema;
    }, []);
  } else {
    return null;
  }
}

const _introspect = (v, name) => {
  try {
    let jsonInput = JSON.stringify(v);
  } catch (e) {
    throw new Error('Input is not valid JSON');
  }
  let type = _check(v);
  let result = {
    type: type
  };
  if (v === null) {
    result.nullable = true;
  }
  if (name) {
    result.name = name;
  }
  if (type === 'array') {
    if (!v.length) {
      result.schema = [{
        type: 'any'
      }];
    } else {
      let initialValue = _introspect(v[0]);
      delete initialValue.type;
      let schema = v.reduce((commonModel, entry) => {
        let entryData = _introspect(entry);
        if (entry === null) {
          commonModel.nullable = true;
        } else if (!commonModel.type) {
          commonModel.type = entryData.type;
        } else if (commonModel.type !== entryData.type) {
          commonModel.type = 'any';
        }
        if (commonModel.type === 'object' || commonModel.type === 'array') {
          commonModel.schema = _mergeSchemas(commonModel.type, commonModel.schema, entryData.schema);
        }
        return commonModel;
      }, initialValue);
      if (!schema.type) {
        schema.type = 'any';
      }
      result.schema = [
        schema
      ];
    }
  } else if (type === 'object') {
    result.schema = Object.keys(v).map((field) => {
      return _introspect(v[field], field);
    });
  } else if (name && v !== null && v !== undefined) {
    result.sampleValue = v;
  }
  return result;
}

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

module.exports = {
  defaultType: 'any',
  list: Object.keys(_validations),
  validate: (type, v, nullable, schema) => (nullable && v === null) || _validations[type](v, schema),
  convert: (type, s) => _convert[type](s),
  format: (type, v) => _format[type](v),
  parse: (type, v, convert) => convert ? _format[type](_convert[type](v)) : _format[type](v),
  check: (v) => _check(v),
  introspect: (v) => _introspect(v),
  sanitize: (type, v) => type in _sanitizations ? _sanitizations[type](v) : v,
  httpResponse: (type, v, headers) => type in _httpResponse ? _httpResponse[type](v, headers) : _httpResponse[''](v, headers)
};
