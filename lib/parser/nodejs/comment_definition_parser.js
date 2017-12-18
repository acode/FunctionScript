const types = require('../../types.js');

const DEFAULT_DEFINITION_FIELD = 'description';
const DEFINITION_FIELDS = [
  'bg',
  'acl',
  'param',
  'returns'
];

class CommentDefinitionParser {

  getLines(commentString) {
    return commentString.split(/\r?\n/);
  }

  stripComments(line) {
    return line.replace(/^\s*\*\s*/, '');
  }

  reduceLines(semanticsList, line) {

    let previous = semanticsList[semanticsList.length - 1];

    if (line[0] === '@') {
      line = line.substr(1);
      let splitLine = line.split(' ');
      let field = splitLine.shift();
      line = splitLine.join(' ');
      if (DEFINITION_FIELDS.indexOf(field) === -1) {
        throw new Error(`Invalid Definition Field: "${field}"`);
      } else if (
        previous &&
        previous.field !== DEFAULT_DEFINITION_FIELD &&
        DEFINITION_FIELDS.indexOf(previous.field) > DEFINITION_FIELDS.indexOf(field)
      ) {
        throw new Error(
          `Invalid Definition Field Order: ` +
          `"${field}" must follow "${previous.field}" ` +
          `(Order: ${DEFINITION_FIELDS.join(', ')})`
        );
      }
      semanticsList.push({
        field: field,
        values: [line.trim()]
      });
    } else {
      if (previous && previous.field != 'bg') {
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

  getAcl(values) {
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
    return value;
  }

  getBg(values) {
    values = values.join(' ').split(' ');
    return {
      mode: values[0],
      value: values.slice(1).join(' ').trim()
    };
  }

  getParameter(values, hasName) {
    let value = values.join(' ');
    let matches = value.match(/^\{.*?\}\s*/);
    if (!matches) {
      throw new Error(`Invalid setting: "${value}"`);
    }
    let type = matches[0];
    value = value.substr(type.length).trim();
    type = type.replace(/^\{(.*?)\}.*$/, '$1').toLowerCase();
    if (types.list.indexOf(type) === -1) {
      throw new Error(`Type "${type}" not supported, must be one of ${types.list.map(v => '"' + v + '"').join(', ')}`);
    }
    if (hasName) {
      let splitValue = value.split(' ');
      return {
        name: splitValue[0],
        type: type,
        description: splitValue.slice(1).join(' ')
      };
    } else {
      return {
        type: type,
        description: value
      };
    }
  }

  createDefinition(definition, data) {

    let field = data.field;
    let values = data.values;

    try {

      if (field === 'description') {
        definition.description = values.join(' ');
      } else if (field === 'param') {
        definition.params = definition.params || [];
        definition.params.push(this.getParameter(values, true));
      } else if (field === 'returns') {
        definition.returns = this.getParameter(values, false);
      } else if (field === 'bg') {
        definition.bg = this.getBg(values);
      } else if (field === 'acl') {
        definition.acl = this.getAcl(values);
      }

    } catch (e) {

      e.message = `Comment Definition Error ("${field}"): ${e.message}`;
      throw e;

    }

    return definition;

  }

  parse(name, commentString) {

    return this.getLines(commentString)
      .map(line => this.stripComments(line))
      .reduce((semanticsList, line) => this.reduceLines(semanticsList, line), [])
      .reduce(
        this.createDefinition.bind(this),
        {
          name: name,
          description: '',
          bg: null,
          context: null,
          params: [],
          acl: null,
          returns: {
            type: 'any',
            description: ''
          }
        }
      );

  }

}

module.exports = CommentDefinitionParser;
