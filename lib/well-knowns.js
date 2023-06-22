const YAML = require('json-to-pretty-yaml');

const FunctionScriptToJSONSchemaMapping = {
  'boolean': (param) => {
    let json = {};
    json.type = 'boolean';
    return json;
  },
  'string': (param) => {
    let json = {};
    json.type = 'string';
    if (param.options && param.options.values) {
      json.enum = param.options.values;
    }
    return json;
  },
  'number': (param) => {
    let json = {};
    json.type = 'number';
    if (param.range) {
      json.minimum = param.range[0];
      json.maximum = param.range[1];
    }
    if (param.options && param.options.values) {
      json.enum = param.options.values;
    }
    return json;
  },
  'float': (param) => {
    let json = {};
    json.type = 'number';
    if (param.range) {
      json.minimum = param.range[0];
      json.maximum = param.range[1];
    }
    if (param.options && param.options.values) {
      json.enum = param.options.values;
    }
    return json;
  },
  'integer': (param) => {
    let json = {};
    json.type = 'integer';
    if (param.range) {
      json.minimum = param.range[0];
      json.maximum = param.range[1];
    }
    if (param.options) {
      json.enum = param.options;
    }
    return json;
  },
  'array': (param) => {
    let json = {};
    json.type = 'array';
    if (param.schema && param.schema.length) {
      json.items = convertParamToJSONSchema(param.schema[0]);
    }
    return json;
  },
  'object': (param) => {
    let schemas = [param.schema || []].concat(param.alternateSchemas || []);
    schemas = schemas.filter(schema => schema.length > 0);
    if (schemas.length > 1) {
      return {
        oneOf: schemas.map(schema => convertParametersArrayToJSONSchema(schema))
      };
    } else {
      return convertParametersArrayToJSONSchema(schemas[0] || []);
    }
  },
  'enum': (param) => {
    let json = {};
    json.enum = param.members.map(member => member[0]);
    return json;
  },
  'buffer': (param) => {
    let json = {};
    json.type = 'object';
    json.properties = {
      '_base64': {type: 'string', contentEncoding: 'base64'},
    };
    return json;
  },
  'object.http': (param) => {
    let json = {};
    json.type = 'object';
    json.properties = {
      'statusCode': {type: 'integer'},
      'headers': {type: 'object'},
      'body': {type: 'string'}
    };
    return json;
  },
  'object.keyql.query': (param) => {
    let json = {};
    json.type = 'object';
    return json;
  },
  'object.keyql.limit': (param) => {
    let json = {};
    json.type = 'object';
    json.properties = {
      'count': {type: 'integer', minimum: 0},
      'offset': {type: 'integer', minimum: 0}
    };
    return json;
  },
  'object.keyql.order': (param) => {
    let json = {};
    json.type = 'array';
    json.items = {
      type: 'object',
      properties: {
        'field': {type: 'string'},
        'sort': {enum: ['ASC', 'DESC']}
      }
    };
    return json;
  },
  'any': (param) => {
    let json = {};
    return json;
  }
};

const convertParamToJSONSchema = (param) => {
  let convert = FunctionScriptToJSONSchemaMapping[param.type];
  if (typeof convert === 'function') {
    let json = convert(param);
    if (param.description) {
      json.description = param.description;
    }
    if (param.defaultValue !== null) {
      json.default = param.defaultValue;
    }
    return json;
  } else {
    throw new Error(`Invalid param type for JSON Schema: "${param.type}"`);
  }
};

const convertParametersArrayToJSONSchema = (params) => {
  return params.reduce((obj, param) => {
    obj.properties[param.name] = convertParamToJSONSchema(param);
    if (!param.hasOwnProperty('defaultValue')) {
      obj.required = obj.required || [];
      obj.required.push(param.name);
    }
    return obj;
  }, {
    type: 'object',
    properties: {}
  });
};

const generateOpenAPISpec = (definitions, plugin, server, origin, identifier) => {

  const paths = Object.keys(definitions)
    .filter(key => {
      let def = definitions[key];
      return def.format.language !== 'static';
    })
    .reduce((paths, key) => {
      let def = definitions[key];
      let parts = key.split('/');
      if (!parts[parts.length - 1]) {
        parts.pop();
      }
      let name = parts.join('_').replace(/[^a-z0-9\-\_]+/gi, '-') || '_';
      let route = `/${key}`;
      if (route.match(/:notfound$/)) {
        route = route.replace(/:notfound$/, '*/');
      } else if (!route.endsWith('/')) {
        route = route + '/';
      }
      let opIdentifier = identifier.replace(/\[(.*)\]/gi, '');
      let operationId = `${opIdentifier}${parts.length ? ('.' + parts.join('.')) : ''}`;
      operationId = operationId.replace(/[^A-Z0-9_]+/gi, '_');
      operationId = operationId.replace(/^_+/gi, '');
      operationId = operationId.replace(/_+$/gi, '');
      let pathData = {
        description: def.description,
        operationId: operationId
      };
      // If we have at least one required parameter...
      if (def.params.filter(param => !param.hasOwnProperty('defaultValue').length > 0)) {
        pathData.requestBody = {
          'content': {
            'application/json': {
              'schema': {
                ...convertParametersArrayToJSONSchema(def.params)
              }
            }
          }
        }
      };
      if (def.returns && def.returns.type !== 'object.http') {
        pathData.responses = {
          '200': {
            'content': {
              'application/json': {
                'schema': {
                  ...convertParamToJSONSchema(def.returns)
                }
              }
            }
          }
        };
      }
      paths[route] = {
        post: pathData
      };
      return paths;
    }, {});

  const spec = {
    openapi: '3.1.0',
    info: {
      version: plugin.version,
      title: plugin.name,
      description: plugin.description
    },
    servers: [
      {
        url: origin,
        description: server
      }
    ],
    paths: paths
  };

  if (plugin.termsOfService) {
    spec.info.termsOfService = plugin.termsOfService;
  }

  if (plugin.contact) {
    const {name, url, email} = plugin.contact;
    if (name || url || email) {
      spec.info.contact = {};
    }
    name && (spec.info.contact.name = name);
    url && (spec.info.contact.url = url);
    email && (spec.info.contact.email = email);
  }

  return spec;

};

const wellKnowns = {

  validatePlugin: (rawPlugin, origin) => {

    const plugin = {};

    if (rawPlugin && typeof rawPlugin !== 'object' || Array.isArray(rawPlugin)) {
      throw new Error(`"plugin" must be an object`);
    }

    plugin.name = rawPlugin.name || '(No name provided)';
    plugin.description = rawPlugin.description || '(No description provided)';
    plugin.version = rawPlugin.version || 'local';
    plugin.image_url = rawPlugin.image_url || null;
    if (
      typeof plugin.image_url === 'string' &&
      plugin.image_url.startsWith('/')
    ) {
      plugin.image_url = `${origin}${plugin.image_url}`;
    }

    plugin.forModel = rawPlugin.forModel || {};
    plugin.forModel.name = plugin.forModel.name || plugin.name;
    plugin.forModel.description = plugin.forModel.description || plugin.description;

    plugin.termsOfService = rawPlugin.termsOfService || null;
    if (
      typeof plugin.termsOfService === 'string' &&
      plugin.termsOfService.startsWith('/')
    ) {
      plugin.termsOfService = `${origin}${plugin.termsOfService}`;
    }

    plugin.contact = rawPlugin.contact || {};

    const checkPluginValue = (name, isRequired = false) => {
      let names = name.split('.');
      let check = plugin;
      for (let i = 0; i < names.length; i++) {
        let n = names[i];
        check = check[n];
      }
      if (typeof check !== 'string') {
        if (check === null || check === void 0) {
          if (isRequired) {
            throw new Error(`plugin.${name} is required`);
          }
        } else {
          throw new Error(`plugin.${name} must be a string`);
        }
      }
    };

    [
      'name',
      'description',
      'version',
      'forModel.name',
      'forModel.description'
    ].forEach(name => checkPluginValue(name, true));

    [
      'image_url',
      'termsOfService',
      'contact.name',
      'contact.url',
      'contact.email'
    ].forEach(name => checkPluginValue(name));

    return plugin;

  },

  handlers: {

    '.well-known/plugin.json': (definitions, plugin, server, origin, identifier) => {

      const body = Buffer.from(JSON.stringify(plugin, null, 2));
      return {
        headers: {
          'Content-Type': 'application/json'
        },
        body
      };

    },

    '.well-known/ai-plugin.json': (definitions, plugin, server, origin, identifier) => {

      const AIPlugin = {};
      AIPlugin.schema_version = 'v1';
      AIPlugin.name_for_human = plugin.name.slice(0, 20);
      AIPlugin.name_for_model = plugin.forModel.name.slice(0, 50);
      AIPlugin.name_for_model = AIPlugin.name_for_model.replace(/[^A-Z0-9_]+/gi, '_');
      AIPlugin.name_for_model = AIPlugin.name_for_model.replace(/^_+/gi, '');
      AIPlugin.name_for_model = AIPlugin.name_for_model.replace(/_+$/gi, '');
      AIPlugin.description_for_human = plugin.description.slice(0, 100);
      AIPlugin.description_for_model = plugin.forModel.description.slice(0, 8000);
      AIPlugin.auth = {
        type: 'none'
      };
      AIPlugin.api = {
        type: 'openapi',
        url: `${origin}/.well-known/openapi.yaml`
      };
      AIPlugin.logo_url = `${origin}/logo.png`;
      AIPlugin.contact_email = `noreply@${origin.replace(/^https?\:\/\/(.*)(:\d+)/gi, '$1')}`;
      AIPlugin.legal_info_url = `${origin}/tos.txt`;
      if (plugin.image_url) {
        AIPlugin.logo_url = plugin.image_url;
      }
      if (plugin.contact && plugin.contact.email) {
        AIPlugin.contact_email = plugin.contact.email;
      }
      if (plugin.termsOfService) {
        AIPlugin.legal_info_url = plugin.termsOfService;
      }

      return {
        headers: {
          'Content-Type': 'application/json'
        },
        body: Buffer.from(JSON.stringify(AIPlugin, null, 2))
      };

    },

    '.well-known/openapi.json': (definitions, plugin, server, origin, identifier) => {

      const spec = generateOpenAPISpec(definitions, plugin, server, origin, identifier);
      const body = Buffer.from(JSON.stringify(spec, null, 2));
      return {
        headers: {
          'Content-Type': 'application/json'
        },
        body
      };

    },

    '.well-known/openapi.yaml': (definitions, plugin, server, origin, identifier) => {

      const spec = generateOpenAPISpec(definitions, plugin, server, origin, identifier);
      const body = Buffer.from(YAML.stringify(spec));
      return {
        headers: {
          'Content-Type': 'application/yaml'
        },
        body
      };

    },

    '.well-known/schema.json': (definitions, plugin, server, origin, identifier) => {

      const schema = Object.keys(definitions)
        .filter(key => {
          let def = definitions[key];
          return def.format.language !== 'static';
        })
        .map(key => {
          let def = definitions[key];
          let parts = key.split('/');
          if (!parts[parts.length - 1]) {
            parts.pop();
          }
          let name = parts.join('_').replace(/[^a-z0-9\-\_]+/gi, '-') || '_';
          let route = `/${key}`;
          if (route.match(/:notfound$/)) {
            route = route.replace(/:notfound$/, '*/');
          } else if (!route.endsWith('/')) {
            route = route + '/';
          }
          return {
            name: name,
            description: def.description,
            route: route,
            url: `${origin}${route}`,
            method: `POST`,
            lib: `${identifier}${parts.length ? ('.' + parts.join('.')) : ''}`,
            parameters: convertParametersArrayToJSONSchema(def.params)
          };
        });

      const response = {
        functions: schema
      };

      const body = Buffer.from(JSON.stringify(response, null, 2));

      return {
        headers: {
          'Content-Type': 'application/json'
        },
        body
      };

    }
  }

};

module.exports = wellKnowns;
