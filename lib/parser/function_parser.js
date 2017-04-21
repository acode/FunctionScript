const fs = require('fs');
const path = require('path');

class FunctionParser {

  constructor() {
    this._parsers = Object.keys(this.constructor.parsers).reduce((parsers, lang) => {
      parsers[lang] = new this.constructor.parsers[lang]();
      return parsers;
    }, {});
  }

  getParser(ext) {
    ext = ext.toLowerCase();
    let lang = this.constructor.extensions[ext];
    if (!lang) {
      throw new Error(`No parser found for extension "${ext}"`);
    } else if (!this._parsers[lang]) {
      throw new Error(`No "${lang}" parser available`);
    }
    return this._parsers[lang];
  }

  parseDefinition(pathname, buffer, functionsPath) {

    functionsPath = functionsPath || '';
    functionsPath = (functionsPath && !functionsPath.endsWith('/')) ? `${functionsPath}/` : functionsPath;
    if (!pathname.startsWith(functionsPath)) {
      throw new Error(`Pathname does not start with "${functionsPath}"`);
    }
    let names = pathname.split('/');
    let filename = names.pop();
    let name;
    let ext = filename.split('.').pop();
    let parser = this.getParser(`.${ext}`);
    let suffix;
    name = filename.substr(0, filename.length - ext.length - 1);
    if (name === '__main__') {
      name = names.join('/');
    } else if (name === '__notfound__') {
      name = names.join('/');
      suffix = 'notfound';
    } else {
      name = names.concat(name).join('/');
    }
    name = name.substr(functionsPath.length);
    if (name && !name.match(/^([A-Z][A-Z0-9\_]*\/)*[A-Z][A-Z0-9\_]*$/i)) {
      throw new Error(
        `Invalid function name: ${name} (${filename})\n` +
        `All path segments must be alphanumeric (or -, _) and start with a letter`
      );
    }

    name = name + (suffix ? `:${suffix}` : '');
    let definition;

    try {
      definition = parser.parse(name, buffer.toString());
      definition.pathname = pathname;
    } catch (e) {
      e.message = `Function definition error (${pathname})\n${e.message}`;
      throw e;
    }

    let validations = this.constructor.definitionFields;
    Object.keys(validations).forEach(field => {
      let validate = validations[field];
      let value = definition[field];
      if (!validate(value)) {
        throw new Error(
          `Function definition error (${pathname})\n`+
          `Invalid field "${field}", unexpected value: ${JSON.stringify(value)}`
        );
      }
    });

    return definition;

  }

  readDefinitions(files, functionsPath) {
    functionsPath = (functionsPath && !functionsPath.endsWith('/')) ? `${functionsPath}/` : (functionsPath || '');
    return Object.keys(files).reduce((definitions, pathname) => {
      if (functionsPath && !pathname.startsWith(functionsPath)) {
        return definitions;
      }
      let definition = this.parseDefinition(pathname, files[pathname], functionsPath);
      if (definitions[definition.name]) {
        throw new Error(
          `Function ${definition.name} already exists\n` +
          `If declaring with [dir]/__main__.js, make sure [dir].js isn't a file in the parent directory.`
        );
      }
      definitions[definition.name] = definition;
      return definitions;
    }, {});
  }

  readFiles(rootPath, functionsPath, dirPath, files) {
    functionsPath = functionsPath || '.';
    dirPath = dirPath || '.';
    files = files || {};
    return fs.readdirSync(path.join(rootPath, functionsPath, dirPath)).reduce((files, filename) => {
      let pathname = path.join(rootPath, functionsPath, dirPath, filename);
      let fullPath = path.join(functionsPath, dirPath, filename);
      let filePath = path.join(dirPath, filename);
      if (fs.statSync(pathname).isDirectory()) {
        files = this.readFiles(rootPath, functionsPath, filePath, files);
      } else {
        files[fullPath.split(path.sep).join('/')] = fs.readFileSync(pathname);
      }
      return files
    }, files);
  }

  load(rootPath, functionsPath) {
    let files = this.readFiles(rootPath, functionsPath);
    return this.readDefinitions(files, functionsPath);
  }

}

FunctionParser.parsers = {
  'nodejs': require('./nodejs/exported_function_parser.js')
};

FunctionParser.extensions = {
  '.js': 'nodejs'
};

FunctionParser.definitionFields = {
  'name': name => typeof name === 'string',
  'format': format => {
    return format &&
      typeof format === 'object' &&
      typeof format.language === 'string';
  },
  'description': description => typeof description === 'string',
  'context': context => typeof context === 'object',
  'params': params => {
    return Array.isArray(params) && params.filter(param => {
      return param &&
        typeof param == 'object' &&
        'name' in param && 'description' in param && 'type' in param;
    }).length === params.length;
  },
  'returns': returns => {
    return returns &&
      typeof returns === 'object' &&
      'description' in returns && 'type' in returns;
  }
};

module.exports = FunctionParser;
