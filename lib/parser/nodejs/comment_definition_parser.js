const types = require('../../types.js');

const DEFAULT_DEFINITION_FIELD = 'description';
const DEFINITION_FIELDS = [
  'bg',
  'keys',
  'charge',
  'acl',
  'param',
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
      if (!field && previous && (previous.field === 'param' || previous.field === 'returns')) {
        previous.schema = (previous.schema || []).concat(line);
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
    } else {
      if (previous) {
        previous.values = previous.values.concat(line.trim());
      } else {
        semanticsList.push({
          field: DEFAULT_DEFINITION_FIELD,
          values: [line.trim()]
        });
      }
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

  getBg (values) {
    values = values.join(' ').split(' ');
    return {
      mode: values[0],
      value: values.slice(1).join(' ').trim()
    };
  }

  getKeys (values) {
    return values.join(' ').split(/\s+/);
  }

  getParameter (values, schema) {
    if (!Array.isArray(values)) {
      values = [values];
    }
    let value = values.join(' ');
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
      let splitValue = values[0].split(' ').slice(1);
      param.name = splitValue.shift();
      param.description = splitValue.join(' ');
      param.members = this.parseEnumMembers(values.slice(1));
      return param;
    }

    let splitValue = value.split(' ');
    param.name = splitValue.shift();
    param.description = splitValue.join(' ');
    if (schema) {
      if (!['object', 'array'].includes(type)) {
        throw new Error(`Can not provide schema for type: "${type}"`);
      }
      param.schema = this.parseSchema(schema, type === 'object');
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
    let schema = data.schema;

    try {

      if (field === 'description') {
        definition.description = values.join('\n');
      } else if (field === 'param') {
        definition.params = definition.params || [];
        definition.params.push(this.getParameter(values, schema));
      } else if (field === 'returns') {
        definition.returns = this.getParameter(values, schema);
      } else if (field === 'bg') {
        definition.bg = this.getBg(values);
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

    return this.getLines(commentString)
      .map(line => this.stripComments(line))
      .reduce((semanticsList, line) => this.reduceLines(semanticsList, line), [])
      .reduce(
        this.createDefinition.bind(this),
        {
          name: name,
          description: '',
          acl: null,
          bg: null,
          keys: [],
          context: null,
          params: [],
          returns: {
            type: 'any',
            description: ''
          }
        }
      );

  }

  parseSchema (schema, multipleKeys) {

    if (schema.length && this.getLineDepth(schema[0])) {
      throw new Error(`Invalid Schema definition at: "${schema[0]}"`);
    }

    let parsedSchema = this._parseSchema(schema, [], 0);

    if (!multipleKeys && parsedSchema.length > 1) {
      throw new Error('Schema for "array" can only support one top-level key that maps to every element.');
    }

    return parsedSchema;

  }

  _parseSchema (schema, params, lastDepth) {

    if (!schema.length) {
      return params;
    }

    let line = schema.shift();
    let depth = this.getLineDepth(line);
    let param = this.getParameter(line.trim());
    let lastParam = params[params.length - 1];
    let step = depth - lastDepth;

    if (!lastParam || step === 0) {
      params.push(param);
      return this._parseSchema(schema, params, depth);
    }

    if (step === 1) {
      if (lastParam.type !== 'object' && lastParam.type !== 'array') {
        throw new Error(`Invalid Schema definition at: "${line}"`);
      }
      lastParam.schema = this._parseSchema(schema, [param], depth);
      return this._parseSchema(schema, params, lastDepth);
    }

    if (step > 1) {
      throw new Error(`Invalid Schema definition at: "${line}"`);
    }

    schema.unshift(line);
    return params;

  }

  getLineDepth(line) {

    let depth = (line.length - line.replace(/^\s*/, '').length) / 2;

    if (Math.round(depth) !== depth) {
      throw new Error(`Invalid Schema definition at: "${line}"`);
    }

    return depth;

  }

  parseEnumMembers(lines) {
    const parseMember = line => {
      if (line[0] !== '[' || line[line.length - 1] !== ']') {
        throw new Error(
          `Invalid Enum Member "${line}". Each member must be a two element array [{string}, {any}]`
        );
      }

      let split = line.indexOf(',');
      if (split === -1) {
        throw new Error(
          `Invalid Enum Member "${line}". Each member must be a two element array [{string}, {any}]`
        );
      }

      let identifier = line.slice(1, split);
      let value = line.slice(split + 2, line.length - 1).trim();

      try {
        value = JSON.parse(value);
      } catch (err) {
        throw new Error(
          `Invalid Enum Member "${line}". Could not parse the right hand side "${value}" as JSON`
        );
      }

      return [identifier, value];
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
