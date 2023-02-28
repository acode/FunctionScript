const backgroundValidator = require('../../background_validator.js');
const types = require('../../types.js');
const validateParameterName = require('./validate_parameter_name.js');

const DEFAULT_DEFINITION_FIELD = 'description';
const DEFINITION_FIELDS = [
  'origin',
  'background',
  'keys',
  'charge',
  'acl',
  'param',
  'stream',
  'returns'
];

class CommentDefinitionParser {

  getLines (commentString) {
    return commentString.split(/\r?\n/);
  }

  stripComments (line) {
    return line.replace(/^\s*\*\s*/, '');
  }

  reduceLines (semanticsList, line) {

    let previous = semanticsList[semanticsList.length - 1];

    if (line[0] === '@') {
      line = line.substr(1);
      let splitLine = line.split(' ');
      let field = splitLine.shift();
      line = splitLine.join(' ');
      if (
        !field &&
        previous &&
        (
          previous.field === 'param' ||
          previous.field === 'stream' ||
          previous.field === 'returns'
        )
      ) {
        previous.textSchema = (previous.textSchema || []).concat([[line]]);
        return semanticsList;
      } else if (DEFINITION_FIELDS.indexOf(field) === -1) {
        throw new Error(`Invalid Definition Field: "${field}"`);
      } else if (
        previous &&
        previous.field !== DEFAULT_DEFINITION_FIELD &&
        DEFINITION_FIELDS.indexOf(previous.field) > DEFINITION_FIELDS.indexOf(field)
      ) {
        throw new Error(
          `Invalid Definition Field Order: ` +
          `"${previous.field}" must follow "${field}" ` +
          `(Order: ${DEFINITION_FIELDS.join(', ')})`
        );
      }
      semanticsList.push({
        field: field,
        values: [line.trim()]
      });
    } else if (previous) {
      let lastSchemaItem = previous.textSchema
        ? previous.textSchema[previous.textSchema.length - 1]
        : [''];
      let isEnum = /^{\??enum}/i.test(lastSchemaItem[0].trim());
      // Enums inside schemas need to be collected as a single item
      if (isEnum) {
        lastSchemaItem = lastSchemaItem.concat(line.trim());
        previous.textSchema[previous.textSchema.length - 1] = lastSchemaItem;
      } else {
        previous.values = previous.values.concat(line.trim());
      }
    } else {
      semanticsList.push({
        field: DEFAULT_DEFINITION_FIELD,
        values: [line.trim()]
      });
    }

    return semanticsList;

  }

  getAcl (values) {
    let acl = {
      '*': false
    };
    if (values[0]) {
      if (values[0] === '*') {
        acl['*'] = true;
      } else {
        throw new Error(`Invalid ACL First Line: "${values[0]}", must be "" (ALLOW NONE) or "*" (ALLOW ALL)`);
      }
    }
    return values.slice(1).reduce((acl, line) => {
      let aclDefinition = line.split(/\s+/);
      if (aclDefinition.length !== 3) {
        throw new Error(`Invalid ACL Definition: "${aclDefinition}"`);
      }
      let name = aclDefinition[0];
      let value = aclDefinition[1];
      let allow = {'allow': true, 'deny': false}[aclDefinition[2]];
      if (!name.match(/^[a-z0-9_]+$/i)) {
        throw new Error(`Invalid ACL Name: "${name}"`);
      } else if (!value) {
        throw new Error(`Invalid ACL Value: "${value}"`);
      } else if (allow === undefined) {
        throw new Error(`Invalid ACL Permission: "${aclDefinition[2]}" must be "allow" or "deny"`);
      }
      acl[name] = acl[name] || {};
      if (acl[name][value] !== undefined) {
        throw new Error(`Duplicate ACL entry: "${line}"`);
      }
      if (allow === acl['*']) {
        throw new Error(`Invalid ACL entry: ${name} ${value} is already ${allow ? 'allowed' : 'blocked'}`);
      }
      acl[name][value] = allow;
      return acl;
    }, acl);
  }

  getOrigin (values) {
    let value = values.join(' ').trim();
    let origins = [];
    if (!value.match(/^(https?:\/\/)?([a-z0-9\-]{0,255}\.)*?([a-z0-9\-]{1,255})(:[0-9]{1,5})?$/gi)) {
      throw new Error([
        `Invalid origin: "${value}".`,
        ` Must be a valid hostname consisting of alphanumeric characters or "-"`,
        ` separated by ".".`,
        ` Supported protocols are "http://" and "https://", if left absent both`,
        ` will be enabled.`
      ].join(''));
    }
    if (!value.match(/^https?:\/\//gi)) {
      origins.push(`https://${value}`);
      origins.push(`http://${value}`);
    } else {
      origins.push(value);
    }
    return origins;
  }

  getBackground (values) {
    values = values.join(' ').split(' ');
    let mode = values[0].trim() || backgroundValidator.defaultMode;
    let value = values.slice(1).join(' ').trim();
    let modes = Object.keys(backgroundValidator.modes);
    if (modes.indexOf(mode) === -1) {
      throw new Error([
        `Invalid Background mode: "${mode}". Please specify \`@background MODE\``,
        ` where MODE is one of: "${modes.join('", "')}" (without quotes).`,
        ` If no mode is provided, the default "${backgroundValidator.defaultMode}" will be used.`
      ].join(''));
    }
    return {
      mode: mode,
      value: value
    };
  }

  getKeys (values) {
    return values.join(' ').split(/\s+/);
  }

  getParameter (values, textSchema = [], depth = 0) {

    if (!Array.isArray(values)) {
      values = [values];
    }

    let value = values.join(' ');
    let defaultMetafield = '';
    let options = '';
    let range = '';

    if (value.indexOf('{?}') !== -1 && value.indexOf('{!}') > value.indexOf('{?}')) {
      throw new Error('defaultMetafield {!} must come before options {?}');
    }

    if (value.indexOf('{:}') !== -1) {
      if (value.indexOf('{!}') > value.indexOf('{:}')) {
        throw new Error(`defaultMetafield {!} must come before range {:}`)
      }
      if (value.indexOf('{?}') > value.indexOf('{:}')) {
        throw new Error(`options {?} must come before range {:}`);
      }
    }

    if (value.indexOf('{!}') !== -1) {
      defaultMetafield = (value.split('{!}')[1] || '').trim();
      value = value.split('{!}')[0].trim();
      if (defaultMetafield.indexOf('{?}') !== -1) {
        options = (defaultMetafield.split('{?}')[1] || '').trim();
        defaultMetafield = defaultMetafield.split('{?}')[0].trim();
        range = (options.split('{:}')[1] || '').trim();
        options = options.split('{:}')[0].trim();
      } else {
        range = (defaultMetafield.split('{:}')[1] || '').trim();
        defaultMetafield = defaultMetafield.split('{:}')[0].trim();
      }
    } else if (value.indexOf('{?}') !== -1) {
      options = (value.split('{?}')[1] || '').trim();
      value = value.split('{?}')[0].trim();
      range = (options.split('{:}')[1] || '').trim();
      options = options.split('{:}')[0].trim();
    } else {
      range = (value.split('{:}')[1] || '').trim();
      value = value.split('{:}')[0].trim();
    }

    let param = {};
    let matches = value.match(/^\{.*?\}\s*/);
    if (!matches) {
      throw new Error(`Invalid setting: "${value}"`);
    }

    let type = matches[0];
    value = value.substr(type.length).trim();
    type = type.replace(/^\{(.*?)\}.*$/, '$1').toLowerCase();
    if (type.startsWith('?')) {
      type = type.slice(1);
      param.defaultValue = null;
    }
    param.type = type;

    if (!types.list.includes(type)) {
      throw new Error(`Type "${type}" not supported, must be one of ${types.list.map(v => '"' + v + '"').join(', ')}`);
    }

    if (type === 'enum') {
      let splitValue = values[0].trim().split(' ').slice(1);
      param.name = splitValue.shift();
      param.description = splitValue.join(' ');
      param.members = this.parseEnumMembers(values.slice(1));
      return param;
    }

    let splitValue = value.split(' ');
    param.name = splitValue.shift();
    param.description = splitValue.join(' ');
    if (textSchema.length) {
      if (!['object', 'array'].includes(type)) {
        throw new Error(`Can not provide schema for type: "${type}"`);
      }
      let schemas = this.parseSchemas(textSchema, depth, type === 'object');
      param.schema = schemas.shift();
      if (schemas.length) {
        param.alternateSchemas = schemas;
      }
    }

    if (defaultMetafield) {
      if (!defaultMetafield.match(/^([a-z][a-z0-9\_]+\.?)+$/gi)) {
        throw new Error(`defaultMetafield {!}: Invalid value for "${param.name}": "${defaultMetafield}"`);
      }
      param.defaultMetafield = defaultMetafield;
    }

    if (options) {
      if (types.optionsAllowed.indexOf(param.type) === -1) {
        throw new Error(`Options {?}: Not allowed for type "${param.type}" for parameter "${param.name}"`);
      }
      param.options = {};
      let opt = options.split(' ');
      let values;
      try {
        values = JSON.parse(options);
      } catch (e) {
        values = null;
      }
      if (Array.isArray(values)) {
        if (values.length === 0) {
          throw new Error(`Options {?}: Must provide non-zero options length`);
        }
        let paramType = (param.type === 'object.keyql.query' || param.type === 'object.keyql.order')
          ? 'string'
          : param.type;
        values.forEach(v => {
          if (!types.validate(paramType, v)) {
            throw new Error(`Options {?}: "${param.name}", type mismatch for type ${param.type} ("${options}")`);
          }
        });
        param.options.values = values;
      } else {
        if (!opt[0] || opt[0].indexOf('.') === -1) {
          throw new Error(`Options {?}: Invalid API call for "${param.name}": "${opt[1]}"`);
        } else {
          let call = /^(.+?)(?:\((.*)\))?$/gi.exec(opt[0]);
          param.options.lib = call[1];
          if (call[2]) {
            param.options.map = (call[2] || '').split(',').reduce((map, p) => {
              let key = p.split('=')[0];
              let value = p.split('=').slice(1).join('=');
              if (!key.match(/^[a-z0-9\_]+$/i) || !value.match(/^[a-z0-9\_]+$/i)) {
                throw new Error(`Options {?}: Invalid API call parameters for "${param.name}": "${call[2]}"`);
              }
              map[key] = value;
              return map;
            }, {});
          }
        }
        opt[1] = opt[1] || '$';
        opt[2] = opt[2] || opt[1];
        param.options.extract = {
          labels: opt[1],
          values: opt[2]
        };
      }
    }

    if (range) {
      if (types.rangeAllowed.indexOf(param.type) === -1) {
        throw new Error(`Range {:}: Not allowed for type "${param.type}" for parameter "${param.name}"`);
      }
      let span;
      try {
        span = JSON.parse(range);
      } catch (e) {
        span = null;
      }
      if (!Array.isArray(span)) {
        throw new Error(`Range {:}: "${param.name}" invalid, expecting array [min, max] ("${range}")`);
      }
      let paramType = (param.type === 'object.keyql.limit')
        ? 'integer'
        : param.type;
      span.forEach(s => {
        if (!types.validate(paramType, s)) {
          throw new Error(`Range {:}: "${param.name}", type mismatch for type ${param.type} ("${range}")`);
        }
      });
      if (span.length !== 2) {
        throw new Error(`Range {:}: "${param.name}" invalid length, expecting array [min, max] ("${range}")`);
      } else if (span[0] > span[1]) {
        throw new Error(`Range {:}: "${param.name}" invalid, max must be greater than min in [min, max] ("${range}")`);
      }
      if (param.type === 'object.keyql.limit') {
        if (span[0] < 0 || span[1] < 0) {
          throw new Error(`Range {:}: "${param.name}" invalid value, [min, max] must both be greater than or equal to 0 ("${range}")`);
        }
      }
      param.range = {min: span[0], max: span[1]};
    }

    return param;

  }

  getCharge (values) {
    if (values.length !== 1) {
      throw new Error(`Charge ${values.join(' ')} not supported, must be a single integer`);
    }
    if (isNaN(values[0])) {
      throw new Error(`Charge ${values[0]} not supported, must be an integer`);
    }
    return parseInt(values[0]);
  }

  createDefinition (definition, data) {

    let field = data.field;
    let values = data.values;
    let textSchema = data.textSchema;

    try {

      if (field === 'description') {
        definition.description = values.join('\n');
      } else if (field === 'param') {
        definition.params = definition.params || [];
        definition.params.push(this.getParameter(values, textSchema));
        definition.params.forEach(param => {
          if (!validateParameterName(param.name)) {
            throw new Error(`Invalid parameter name "${param.name}"`);
          }
        });
      } else if (field === 'stream') {
        definition.streams = definition.streams || [];
        definition.streams.push(this.getParameter(values, textSchema));
        definition.streams.forEach(stream => {
          if (!validateParameterName(stream.name)) {
            throw new Error(`Invalid stream name "${stream.name}"`);
          }
        });
      } else if (field === 'returns') {
        definition.returns = this.getParameter(values, textSchema);
      } else if (field === 'origin') {
        definition.origins = definition.origins || [];
        definition.origins = [].concat(
          definition.origins,
          this.getOrigin(values)
        );
      } else if (field === 'background') {
        definition.background = this.getBackground(values);
      } else if (field === 'acl') {
        definition.acl = this.getAcl(values);
      } else if (field === 'charge') {
        definition.charge = this.getCharge(values);
      } else if (field === 'keys') {
        definition.keys = this.getKeys(values);
      }

    } catch (e) {

      e.message = `Comment Definition Error ("${field}"): ${e.message}`;
      throw e;

    }

    return definition;

  }

  parse (name, commentString) {

    commentString = commentString || '';
    return this.getLines(commentString)
      .map(line => this.stripComments(line))
      .reduce((semanticsList, line) => this.reduceLines(semanticsList, line), [])
      .reduce(
        this.createDefinition.bind(this),
        {
          name: name,
          description: '',
          origins: null,
          acl: null,
          background: null,
          keys: [],
          streams: null,
          context: null,
          params: [],
          returns: {
            name: '',
            type: 'any',
            description: ''
          }
        }
      );

  }

  parseSchemas (textSchema, depth = 0, allowMultipleEntries = false) {
    let schemas = [];
    while (textSchema.length) {
      let line = textSchema[0][0];
      let params = [];
      let schema = this._parseSchema(textSchema, params, depth);
      if (!allowMultipleEntries && schema.length > 1) {
        throw new Error(`Invalid Schema definition at "${line}": Schema for "array" can only support one top-level key that maps to every element.`);
      }
      schemas.push(schema);
    }
    if (!allowMultipleEntries && schemas.length > 1) {
      throw new Error(`Invalid Schema definition at "${line}": Schema for "array" does not support OR (alternateSchemas).`);
    } else if (schemas.filter(params => !params.length).length > 0) {
      throw new Error(`Invalid Schema definition at "${line}": OR (alternateSchemas) requires all schema lengths to be non-zero`);
    }
    return schemas;
  }

  _parseSchema (textSchema, params = [], depth = 0) {

    let values = textSchema.shift();
    let line = values[0];
    let curDepth = this.getLineDepth(line);
    if (depth !== curDepth) {
      throw new Error(`Invalid Schema definition at: "${line}", invalid line depth (expecting ${depth}, found ${curDepth})`);
    }
    if (line.trim() === 'OR') {
      if (!textSchema.length) {
        throw new Error(`Invalid Schema definition at "${line}": OR (alternateSchemas) can not end a schema definition`);
      }
      return params;
    } else {
      let subSchemaEnd = textSchema.findIndex(values => {
        let line = values[0];
        return this.getLineDepth(line) <= curDepth;
      });
      let subSchema;
      if (subSchemaEnd === -1) {
        subSchema = textSchema.splice(0, textSchema.length);
      } else if (subSchemaEnd) {
        subSchema = textSchema.splice(0, subSchemaEnd);
      }
      params.push(this.getParameter(values, subSchema, depth + 1));
      return textSchema.length
        ? this._parseSchema(textSchema, params, depth)
        : params;
    }
  }

  getLineDepth (line) {

    let depth = (line.length - line.replace(/^\s*/, '').length) / 2;

    if (Math.round(depth) !== depth) {
      throw new Error(`Invalid Schema definition at: "${line}"`);
    }

    return depth;

  }

  parseEnumMembers(lines) {
    const parseMember = line => {
      let member;
      try {
        member = JSON.parse(line);
      } catch (err) {
        throw new Error('Enum members must be a JSON array of length 2.');
      }

      if (member.length !== 2) {
        throw new Error('Enum members must be a JSON array of length 2.');
      }

      if (typeof member[0] !== 'string') {
        throw new Error('The left hand side of enum members must be a string');
      }

      return member;
    };

    let members = lines.filter(l => l.length).map(parseMember);

    let identifiers = members.map(m => m[0]).sort();
    let dup = identifiers.find((ident, i) => ident === identifiers[i + 1]);
    if (dup) {
      throw new Error(
        `Invalid Enum. Duplicate member "${dup}" found`
      );
    }

    return members;
  }

}

module.exports = CommentDefinitionParser;
