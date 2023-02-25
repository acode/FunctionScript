const KeyQL = require('keyql');

const OPTIONS_ALLOWED = [
  'string',
  'number',
  'float',
  'integer',
  'object.keyql.query',
  'object.keyql.order',
];

const RANGE_ALLOWED = [
  'number',
  'float',
  'integer',
  'object.keyql.limit'
];

const validate = (type, v, nullable, schemas, options, range, stack = [], mismatch = {}) => {
  if (schemas && !Array.isArray(schemas)) {
    throw new Error(`Argument schemas must be an Array`)
  }
  return (nullable && v === null) ||
    _validations[type](v, schemas, options, range, stack, mismatch);
};

const _validations = {
  string: (v, schemas = [], options = []) => typeof v === 'string' && (options.length ? options.indexOf(v) > -1 : true),
  number: (v, schemas = [], options = []) => typeof v === 'number' && v === v && (options.length ? options.indexOf(v) > -1 : true),
  float: (v, schemas = [], options = []) => parseFloat(v) === v && (options.length ? options.indexOf(v) > -1 : true),
  integer: (v, schemas = [], options = []) => parseInt(v) === v && v >= Number.MIN_SAFE_INTEGER && v <= Number.MAX_SAFE_INTEGER && (options.length ? options.indexOf(v) > -1 : true),
  boolean: (v) => typeof v === 'boolean',
  object: (v, schemas = [], options = [], range = {}, stack = [], mismatch = {}) => {
    if (!!v && typeof v === 'object' && !Array.isArray(v) && !Buffer.isBuffer(v)) {
      let matchedSchemas = schemas.filter(schema => {
        for (let i = 0; i < schema.length; i++) {
          let param = schema[i];
          if (!v.hasOwnProperty(param.name) && !param.hasOwnProperty('defaultValue')) {
            mismatch.stack = mismatch.stack || stack.concat(param.name);
            return false;
          } else if (
            !validate(
              param.type,
              v.hasOwnProperty(param.name)
                ? v[param.name]
                : param.defaultValue,
              param.defaultValue === null,
              (
                param.type === 'enum'
                  ? param.members
                  : (param.alternateSchemas || []).concat(param.schema ? [param.schema] : [])
              ),
              param.options && param.options.values,
              param.range,
              stack.concat(param.name),
              mismatch
            )
          ) {
            mismatch.stack = mismatch.stack || stack.concat(param.name);
            return false;
          }
        }
        return true;
      });
      return schemas.length > 0
        ? matchedSchemas.length > 0
        : true;
    } else {
      mismatch.stack = mismatch.stack || stack;
      return false;
    }
  },
  array: (v, schemas = [], options = [], range = {}, stack = [], mismatch = {}) => {
    let schema = schemas[0];
    if (Array.isArray(v)) {
      let param = schema && schema[0];
      if (param) {
        for (let i = 0; i < v.length; i++) {
          let invalidParam = !validate(
            param.type,
            v[i],
            param.defaultValue === null,
            (
              param.type === 'enum'
                ? param.members
                : (param.alternateSchemas || []).concat(param.schema ? [param.schema] : [])
            ),
            param.options && param.options.values,
            param.range,
            stack.length
              ? stack.slice(0, stack.length - 1).concat(`${stack[stack.length - 1]}[${i}]`)
              : stack,
            mismatch
          );
          if (invalidParam) {
            mismatch.stack = mismatch.stack || (
              stack.length
                ? stack.slice(0, stack.length - 1).concat(`${stack[stack.length - 1]}[${i}]`)
                : stack
            );
            return false;
          }
        }
      }
      return true;
    } else {
      mismatch.stack = mismatch.stack || (
        stack.length
          ? stack.slice(0, stack.length - 1).concat(`${stack[stack.length - 1]}[]`)
          : stack
      );
      return false;
    }
  },
  enum: (v, members = []) => {
    return typeof v == 'string'
      ? members.some(member => member[0] === v)
      : false;
  },
  'object.http': v => {
    let isObject = _validations.object(v);
    if (!isObject) {
      return false;
    } else {
      return (
        (
          Object.keys(v).length === 1 &&
          v.hasOwnProperty('body')
        ) ||
        (
          Object.keys(v).length === 2 &&
          v.hasOwnProperty('body') &&
          v.hasOwnProperty('headers')
        ) ||
        (
          Object.keys(v).length === 3 &&
          v.hasOwnProperty('body') &&
          v.hasOwnProperty('headers') &&
          v.hasOwnProperty('statusCode')
        )
      );
    }
  },
  'object.keyql.query': (v, schemas = [], options = []) => {
    try {
      KeyQL.validateQueryObject(v, options);
    } catch (e) {
      return false;
    }
    return true;
  },
  'object.keyql.limit': (v, schemas = [], options = []) => {
    try {
      KeyQL.validateLimit(v);
    } catch (e) {
      return false;
    }
    return true;
  },
  'object.keyql.order': (v, schemas = [], options = []) => {
    try {
      KeyQL.validateOrderObject(v, options);
    } catch (e) {
      return false;
    }
    return true;
  },
  buffer: v => Buffer.isBuffer(_format.buffer(v)),
  any: v => true
};

// Unlike validations, sanitizations will throw errors if failed
const _sanitizations = {
  number: (v, range) => {
    if (range) {
      if (v < range.min) {
        throw new Error(`must be greater than or equal to ${range.min}`);
      } else if (v > range.max) {
        throw new Error(`must less than or equal to ${range.max}`);
      }
    }
    return v;
  },
  float: (v, range) => {
    if (range) {
      if (v < range.min) {
        throw new Error(`must be greater than or equal to ${range.min}`);
      } else if (v > range.max) {
        throw new Error(`must less than or equal to ${range.max}`);
      }
    }
    return v;
  },
  integer: (v, range) => {
    if (range) {
      if (v < range.min) {
        throw new Error(`must be greater than or equal to ${range.mind}`);
      } else if (v > range.max) {
        throw new Error(`must less than or equal to ${range.max}`);
      }
    }
    return v;
  },
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
    obj['body'] = _validations.buffer(obj['body']) ? obj['body'] : Buffer.from(obj['body']);
    return obj;
  },
  'object.keyql.query': v => {
    KeyQL.validateQueryObject(v);
    return v;
  },
  'object.keyql.limit': (v, range) => {
    v = KeyQL.validateLimit(v);
    if (range) {
      if (v.count < range.min) {
        throw new Error(`count must be greater than or equal to ${range[0]}`);
      } else if (v.count > range.max) {
        throw new Error(`count must less than or equal to ${range[1]}`);
      }
    }
    return v;
  },
  'object.keyql.order': v => {
    KeyQL.validateOrderObject(v);
    return v;
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
  '': v => v, // Default does nothing
  string: v => v,
  number: v => v,
  float: v => v,
  integer: v => v,
  boolean: v => v,
  object: v => _convertBuffers(v, true, true),
  'object.http': v => v,
  'object.keyql.query': v => v,
  'object.keyql.limit': v => v,
  'object.keyql.order': v => v,
  array: v => _convertBuffers(v, true, true),
  buffer: v => {
    if (!v || typeof v !== 'object' || Buffer.isBuffer(v)) {
      return v;
    } else if (Object.keys(v).length > 1) {
      return v;
    } else if (Array.isArray(v._bytes)) {
      return Buffer.from(v._bytes.map(v => Math.max(0, Math.min(255, parseInt(v)))));
    } else if (typeof v._base64 === 'string') {
      return Buffer.from(v._base64, 'base64');
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
        if (s1.defaultValue === null || match.defaultValue === null) {
          merged.defaultValue = null;
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
    result.defaultValue = null;
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
          commonModel.defaultValue = null;
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
  object: (s, schema) => {
    let obj = s;
    if (typeof obj !== 'object') {
      obj = JSON.parse(s);
    }
    if (schema && schema.length && obj && typeof obj === 'object') {
      schema
        .filter(param => param.name in obj)
        .forEach(param => {
          obj[param.name] = _convert[param.type](obj[param.name]);
        });
    }
    return obj;
  },
  'object.http': s => JSON.parse(s),
  'object.keyql.query': s => JSON.parse(s),
  'object.keyql.limit': s => {
    return _convert['object'](
      s,
      [
        {name: 'count', type: 'integer'},
        {name: 'offset', type: 'integer'}
      ]
    );
  },
  'object.keyql.order': s => JSON.parse(s),
  array: (s, schema) => {
    let arr = s;
    if (!Array.isArray(arr)) {
      arr = JSON.parse(s);
    }
    if (schema && schema.length && Array.isArray(arr)) {
      arr = arr.map(_convert[schema[0].type]);
    }
    return arr;
  },
  buffer: s => {
    let o = JSON.parse(s);
    return _format.buffer(o);
  },
  any: s => s
};

const _convertBuffers = function (v, applyFormatting, formatRecursively) {
  v = applyFormatting ? _format.buffer(v) : v;
  if (Buffer.isBuffer(v)) {
    return applyFormatting ? v : {_base64: v.toString('base64')};
  } else if (Array.isArray(v)) {
    return v.map(v => _convertBuffers(v, formatRecursively ? applyFormatting : false, formatRecursively));
  } else if (v && typeof v === 'object') {
    return Object.keys(v).reduce(function (n, key) {
      n[key] = _convertBuffers(v[key], formatRecursively ? applyFormatting : false, formatRecursively);
      return n;
    }, {});
  } else {
    return v;
  }
};

const _httpResponse = {
  '': (v, headers) => {
    headers = headers || {};
    let statusCode = headers.status || 200; // legacy support
    delete headers.status;
    return {
      statusCode: statusCode,
      headers: headers,
      body: _convertBuffers(v, true)
    };
  },
  'any': (v, headers) => {
    if (_validations['object.http'](v)) {
      return _sanitizations['object.http'](v);
    } else {
      headers = headers || {};
      let statusCode = headers.status || 200; // legacy support
      delete headers.status;
      return {
        statusCode: statusCode,
        headers: headers,
        body: _convertBuffers(v, true)
      };
    }
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

const _generateSchema = {
  javascript: function (payload, defaultDepth = 0) {
    let definition = _introspect(payload);
    if (definition.type !== 'object') {
      throw new Error('Can only generateSchema from an object');
    }
    let parseSchema = (schema, depth = 0) => {
      return schema.map((field) => {
        let prefix = !depth
          ? ` * @param `
          : ` * @ ${' '.repeat((depth - 1) * 2)}`;
        let fieldContent = field.name ? ` ${field.name}` : '';
        if (field.schema) {
          return [
            `${prefix}{${'defaultValue' in field ? '?' : ''}${field.type}}${fieldContent}`,
            parseSchema(field.schema, depth + 1)
          ].join('\n');
        } else {
          return `${prefix}{${'defaultValue' in field ? '?' : ''}${field.type}}${fieldContent}`;
        }
      }).join('\n');
    };
    let commentDefinition = parseSchema(definition.schema, defaultDepth);
    return commentDefinition;
  }
};

module.exports = {
  optionsAllowed: OPTIONS_ALLOWED,
  rangeAllowed: RANGE_ALLOWED,
  defaultType: 'any',
  list: Object.keys(_validations),
  validate: validate,
  serialize: (type, v) => _convertBuffers(v),
  convert: (type, s) => _convert[type](s),
  format: (type, v) => _format[type](v),
  parse: (type, schema, v, convert) => {
    return convert
      ? _format[type in _format ? type : ''](_convert[type](v, schema))
      : _format[type](v);
  },
  check: (v) => _check(v),
  introspect: (v) => _introspect(v),
  generateSchema: _generateSchema,
  sanitize: (type, v, range) => type in _sanitizations ? _sanitizations[type](v, range) : v,
  httpResponse: (type, v, headers = {}) => type in _httpResponse ? _httpResponse[type](v, headers) : _httpResponse[''](v, headers)
};
