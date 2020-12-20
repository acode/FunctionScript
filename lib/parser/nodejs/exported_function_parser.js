const babylon = require('babylon');

const types = require('../../types.js');
const background = require('../../background.js');

const CommentDefinitionParser = require('./comment_definition_parser.js');

class ExportedFunctionParser {

  constructor() {
    this.language = 'nodejs';
    this.commentDefinitionParser = new CommentDefinitionParser();
    this.literals = {
      NumericLiteral: 'number',
      StringLiteral: 'string',
      BooleanLiteral: 'boolean',
      NullLiteral: 'any',
      ObjectExpression: 'object',
      ArrayExpression: 'array'
    };
    this.validateExpressions = {
      ObjectExpression: (node, stack) => {
        return node.properties.reduce((obj, prop) => {
          let key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value;
          if (prop.method) {
            throw new Error(`(${stack.concat(key).join('.')}) Object literals in default values can not contain functions`);
          } else if (prop.computed) {
            throw new Error(`(${stack.concat(key).join('.')}) Object literals in default values can not contain computed properties`);
          } else {
            obj[key] = this.validateDefaultParameterExpression(key, prop.value, stack);
          }
          return obj;
        }, {});
      },
      ArrayExpression: (node, stack) => {
        return node.elements.map((el, i) => this.validateDefaultParameterExpression(i, el, stack));
      }
    };
  }

  validateDefaultParameterExpression(name, node, stack, obj) {

    stack = (stack || []).slice(0);
    stack.push(name);

    if (!this.literals[node.type]) {
      console.log(node);
      throw new Error(`(${stack.join('.')}) Expected ${Object.keys(this.literals).join(', ')} in Right-Hand of AssignmentPattern`);
    }

    if (this.validateExpressions[node.type]) {
      return this.validateExpressions[node.type](node, stack);
    } else {
      return node.type === 'NullLiteral' ? null : node.value;
    }

  }

  parseModuleExportsStatement(fileString) {

    let AST = babylon.parse(fileString, {
      plugins: [
        'objectRestSpread'
      ]
    });

    let body = AST.program.body;

    let statements = body.filter(item => {
      return (
        item.type === 'ExpressionStatement' &&
        item.expression &&
        item.expression.type === 'AssignmentExpression' &&
        item.expression.operator === '=' &&
        item.expression.left.type === 'MemberExpression' &&
        item.expression.left.object &&
        item.expression.left.object.name === 'module' &&
        item.expression.left.property &&
        item.expression.left.property.name === 'exports'
      )
    });

    if (statements.length > 1) {
      throw new Error(`Too many exports from file via "module.exports"`);
    }

    return statements[0] || null;

  }

  parseFunctionExpressionFromModuleExportsStatement(statement) {
    let expression = statement.expression;
    if (expression.right.type !== 'FunctionExpression' && expression.right.type !== 'ArrowFunctionExpression' ) {
      throw new Error(`"module.exports" must export a valid Function`);
    }
    if (expression.right.generator) {
      throw new Error(`"module.exports" can not export a generator`);
    }
    return expression.right;
  }

  parseParamsFromFunctionExpression(functionExpression) {

    if (!functionExpression) {
      return {
        async: true,
        inline: true,
        context: {},
        params: []
      };
    } else {
      let params = functionExpression.params;

      if (!functionExpression.async) {
        let lastParam = params.pop();
        if (!lastParam || lastParam.type !== 'Identifier' || lastParam.name !== 'callback') {
          throw new Error(`Non-async functions must have parameter named "callback" as the last argument`);
        }
      }

      let paramsObject = {};

      if (params.length) {
        let lastParam = params.pop();
        if (lastParam.type === 'Identifier' && lastParam.name === 'context') {
          paramsObject.context = {};
        } else {
          params.push(lastParam);
        }
      }

      return {
        async: functionExpression.async,
        inline: false,
        context: paramsObject.context || null,
        params: params.slice()
          .reverse()
          .map((param, i) => {
            let formattedParam;
            if (param.type === 'Identifier') {
              if (param.name === 'context') {
                throw new Error(`When specified, "context" must be the last provided (non-callback) argument`);
              }
              if (functionExpression.async && param.name === 'callback') {
                throw new Error(`Async functions can not have a parameter named "callback"`);
              }
              if (!this.validateFunctionParamName(param.name)) {
                throw new Error(`Invalid parameter name "${param.name}"`);
              }
              formattedParam = {name: param.name};
            } else if (param.type === 'AssignmentPattern') {
              if (param.left.type !== 'Identifier') {
                throw new Error('Expected Identifier in Left-Hand of AssignmentPattern');
              }
              if (param.left.name === 'context') {
                throw new Error(`When specified, "context" can not be assigned a default value`);
              }
              if (functionExpression.async && param.left.name === 'callback') {
                throw new Error(`Async functions can not have a parameter named "callback"`);
              }
              if (!this.validateFunctionParamName(param.left.name)) {
                throw new Error(`Invalid parameter name "${param.left.name}"`);
              }
              let defaultValue = this.validateDefaultParameterExpression(param.left.name, param.right);
              formattedParam = {
                name: param.left.name,
                type: this.literals[param.right.type],
                defaultValue: defaultValue
              };
            }
            paramsObject[formattedParam.name] = formattedParam;
            return formattedParam;
          })
          .reverse()
      };
    }

  }

  validateFunctionParamName(param) {
    try {
      let token = babylon.parseExpression(param);
      if (!token || token.type !== 'Identifier') {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  parseCommentFromModuleExportsStatement(moduleStatement) {

    if (!moduleStatement.leadingComments) {
      return '';
    }

    let comments = moduleStatement.leadingComments;
    let lastComment = comments.pop();

    if (lastComment.type !== 'CommentBlock') {
      return '';
    }

    if (lastComment.value[0] !== '*') {
      return '';
    }

    return lastComment.value.replace(/^\*+(?:\r?\n)*((?:\r?\n|.)*?)(?:\r?\n)*$/g, '$1');

  }

  compareParameters(functionParams, commentParams) {
    if (commentParams.length && commentParams.length !== functionParams.length) {
      throw new Error(`Commented parameters do not match function footprint (expected: ${commentParams.length}, actual: ${functionParams.length})`);
    }
    return functionParams.map((param, i) => {
      if (!commentParams.length) {
        param.description = '';
        param.type = param.type || types.defaultType;
      } else {
        let defParam = commentParams[i];
        if (!defParam) {
          throw new Error(`No comment parameter definition found for function parameter "${param.name}"`);
        }
        if (defParam.hasOwnProperty('defaultValue') && !param.hasOwnProperty('defaultValue')) {
          throw new Error(`Comment parameter definition "${defParam.name}" is marked as optional but does not have a default value`);
        }
        if (defParam.name !== param.name) {
          throw new Error(`Comment parameter definition "${defParam.name}" does not match function parameter "${param.name}"`);
        }
        var type = param.type === types.defaultType
          ? defParam.type
          : param.type;
        if (param.hasOwnProperty('defaultValue')) {
          if (
            !types.validate(
              defParam.type,
              param.defaultValue,
              param.defaultValue === null,
              (
                defParam.members ||
                  (defParam.alternateSchemas || []).concat(defParam.schema ? [defParam.schema] : [])
              ),
              defParam.options && defParam.options.values
            )
          ) {
            if (defParam.members) {
              throw new Error(`Parameter "${defParam.name}" does not have member ${JSON.stringify(param.defaultValue)}`);
            } else if (defParam.schema) {
              throw new Error(`Parameter "${defParam.name}" schema does not match ${JSON.stringify(param.defaultValue)}`);
            } else if (defParam.options && defParam.options.values) {
              throw new Error(`Parameter "${defParam.name}" options (${JSON.stringify(defParam.options.values)}) do not contain ${JSON.stringify(param.defaultValue)}`);
            } else {
              throw new Error(`Parameter "${defParam.name}" type "${defParam.type}" does not match the default value ${JSON.stringify(param.defaultValue)} ("${param.type}")`);
            }
          }
        }
        param.type = defParam.type || types.defaultType;
        param.description = defParam.description;
        defParam.defaultMetafield && (param.defaultMetafield = defParam.defaultMetafield);
        defParam.options && (param.options = defParam.options);
        defParam.schema && (param.schema = defParam.schema);
        defParam.alternateSchemas && (param.alternateSchemas = defParam.alternateSchemas);
        defParam.members && (param.members = defParam.members);
      }
      return param;
    });
  }

  parse(name, fileString) {

    let initialError = null;

    let moduleStatement;
    let comment = null;
    let functionExpression = null;

    try {
      moduleStatement = this.parseModuleExportsStatement(fileString);
    } catch (e) {
      if (e.message.startsWith(`'return' outside of function`)) {
        moduleStatement = this.parseModuleExportsStatement(`async function __inline__ (context) {\n${fileString}\n}`);
        moduleStatement = null;
      } else {
        throw e;
      }
    }

    if (moduleStatement) {
      comment = this.parseCommentFromModuleExportsStatement(moduleStatement);
      functionExpression = this.parseFunctionExpressionFromModuleExportsStatement(moduleStatement);
    }

    let commentDefinition = this.commentDefinitionParser.parse(name, comment);
    let functionDefinition = this.parseParamsFromFunctionExpression(functionExpression);

    let description = commentDefinition.description || '';
    let bg = commentDefinition.bg || background.generateDefaultValue();
    let charge = isNaN(commentDefinition.charge) ? 1 : commentDefinition.charge;
    let context = commentDefinition.context || functionDefinition.context;
    let acl = commentDefinition.acl;
    let keys = commentDefinition.keys;
    let isAsync = functionDefinition.async;
    let isInline = functionDefinition.inline;
    let params = this.compareParameters(functionDefinition.params, commentDefinition.params);
    let returns = commentDefinition.returns;

    return {
      name: name,
      format: {
        language: this.language,
        async: isAsync,
        inline: isInline
      },
      description: description,
      bg: bg,
      acl: acl,
      keys: keys,
      charge: charge,
      context: context,
      params: params,
      returns: returns
    };

  }

}

module.exports = ExportedFunctionParser;
