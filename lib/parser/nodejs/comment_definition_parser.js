const types = require('../../types.js');

class CommentDefinitionParser {

  getLines(commentString) {
    return commentString.split(/\r?\n/);
  }

  stripComments(line) {
    return line.replace(/^\s*\*\s*/, '');
  }

  parseLine(line, previous) {
    let semantics = {value: line};
    try {
      return this.getField({value: line}, previous);
    } catch(e) {
      e.message = `Parsing error at "${semantics.value}"\n${e.message}`;
      throw e;
    }
  }

  getField(semantics, previous) {
    if (semantics.value[0] !== '@') {
      if (!previous) {
        semantics.field = 'description';
        semantics.value = semantics.value.replace(/^\s*(.*)?\s*$/, '$1');
        return semantics;
      } else if (previous.field === 'acl') {
        // we actually probably want to store the whole previous object here
      } else {
        throw new Error('Invalid line data');
      }
    } else {
      let value = semantics.value.substr(1);
      let matches = value.match(/^(param|return(s?)|bg|acl)\s*/);
      if (!matches) {
        throw new Error(`Invalid line data`);
      } else {
        let field = matches[0];
        value = value.substr(field.length);
        field = field.replace(/\s*$/, '');
        field = field === 'return' ? 'returns' : field;
        semantics.field = field;
        semantics.value = value;
        if (field === 'returns' || field === 'param') {
          return this.getType(semantics);
        } else if (field === 'bg') {
          return this.getBg(semantics);
        } else if (field === 'acl') {
          return this.getACL(semantics);
        } else {
          return semantics;
        }
      }
    }
  }

  getACL(semantics) {
    let value = semantics.value.trim();
    if (value && value !== '*') {
      throw new Error(`Invalid line data`);
    }
    semantics.value = {
      allowUnlisted: !!value
    };
    return semantics;
  }

  getBg(semantics) {
    let value = semantics.value;
    let values = value.split(' ');
    semantics.value = {
      mode: values[0],
      value: values.slice(1).join(' ').trim()
    };
    return semantics;
  }

  getType(semantics) {
    let value = semantics.value;
    let matches = value.match(/^\{.*?\}\s*/);
    if (!matches) {
      throw new Error(`Invalid line data`);
    }
    let type = matches[0];
    value = value.substr(type.length);
    type = type.replace(/^\{(.*?)\}.*$/, '$1').toLowerCase();
    if (types.list.indexOf(type) === -1) {
      throw new Error(`Type "${type}" not supported, must be one of ${types.list.map(v => '"' + v + '"').join(', ')}`);
    }
    semantics.type = type;
    semantics.value = value;
    return semantics.field !== 'param' ?
      semantics :
      this.getName(semantics);
  }

  getName(semantics) {
    let value = semantics.value;
    let values = value.split(' ');
    let name = values[0];
    value = values.slice(1).join(' ');
    semantics.name = name;
    semantics.value = value.replace(/^\s*(.*?)\s*$/, '$1');
    return semantics;
  }

  validateAclEntry(acl, entryType, identifier, allow) {

    if (!acl['*'] && !allow) {
      throw new Error(`Invalid ACL entry: ${entryType} ${identifier} is already blocked by default`);
    } else if (acl['*'] && allow) {
      throw new Error(`Invalid ACL entry: ${entryType} ${identifier} is already allowed by default`);
    }

    if (typeof acl[entryType][identifier] === 'boolean') {
      throw new Error(`Invalid ACL entry: ${entryType} ${identifier} appears multiple times in ACL`);
    }

  }

  createDefinition(definition, data) {
    if (data.field === 'description') {
      if (!definition.last || definition.last.field === 'description') {
        definition.description = [(definition.description || ''), data.value].join(' ').trim();
      } else if (definition.last.field === 'param') {
        let param = definition.params[definition.params.length - 1];
        param.description = [(param.description || ''), data.value].join(' ').trim();
      } else if (definition.last.field === 'returns') {
        definition.returns.description = [(definition.returns.description || ''), data.value].join(' ').trim();
      } else if (definition.last.field === 'acl') {

        data.field = 'acl';

        if (data.value) {
          let aclEntryComponents = data.value.split(/\s+/);
          let entryType = aclEntryComponents[0];
          let entryIdentifier = aclEntryComponents[1];
          let allow = aclEntryComponents[2] === 'true';

          this.validateAclEntry(definition.acl, entryType, entryIdentifier, allow);
          definition.acl[entryType][entryIdentifier] = allow;
        }

      }
    } else if (data.field === 'param') {
      definition.params = definition.params || [];
      definition.params.push({
        name: data.name,
        description: data.value.trim(),
        type: data.type
      });
    } else if (data.field === 'returns') {
      definition.returns = {
        type: data.type,
        description: data.value.trim()
      };
    } else if (data.field === 'bg') {
      definition.bg = data.value;
    } else if (data.field === 'acl') {
      definition.acl['*'] = data.value.allowUnlisted;
    }
    definition.last = data;
    return definition;
  }

  parse(name, commentString) {

    let definitionInput = this.getLines(commentString)
      .map(line => this.stripComments(line))
      .reduce((parsed, line) => {
        let entry = this.parseLine(line, parsed.previous);
        if (entry !== parsed.entries[parsed.entries.length - 1]) {
          parsed.entries.push(entry);
        }
        parsed.previous = entry;
        return parsed;
      }, {
        previous: null,
        entries: []
      });

    let definition = definitionInput.entries.reduce(
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
        },
      }
    );
    delete definition.last;
    return definition;

  }

}

module.exports = CommentDefinitionParser;
