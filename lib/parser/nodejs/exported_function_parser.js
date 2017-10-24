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
          if (prop.method) {
            throw new Error(`(${stack.concat(prop.key.name).join('.')}) Object literals in default values can not contain functions`);
          } else if (prop.computed) {
            throw new Error(`(${stack.concat(prop.key.name).join('.')}) Object literals in default values can not contain computed properties`);
          } else {
            obj[prop.key.name] = this.validateDefaultParameterExpression(prop.key.name, prop.value, stack);
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

    let AST = babylon.parse(fileString);
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

    if (!statements.length) {
      throw new Error(`Nothing exported from file via "module.exports"`);
    }

    if (statements.length > 1) {
      throw new Error(`Too many exports from file via "module.exports"`);
    }

    return statements[0];

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
        if (defParam.name !== param.name) {
          throw new Error(`Comment parameter definition "${defParam.name}" does not match function parameter "${param.name}"`);
        }
        if (param.type && param.type !== types.defaultType) {
          if (defParam.type !== param.type && !types.validate(defParam.type, param.defaultValue)) {
            throw new Error(`Comment parameter definition "${defParam.name}": type "${defParam.type}" does not match function parameter type "${param.type}"`);
          }
        } else {
          param.type = defParam.type || types.defaultType;
        }
        param.description = defParam.description;
      }
      if (i === 0 && (param.type === 'object' || param.type === 'any')) {
        throw new Error([
          ``,
          `First parameter can not be of type "Any" or "Object"`,
          `This restriction is intended to reduce end-user confusion around your API,`,
          `if a function is called using only an Object, its properties map to function parameters`,
          ``,
          `If you wish to receive only an Object as a function parameter, use one of these function footprints`,
          `(and access any passed parameters via "context.params")`,
          ``,
          `  async function(context) {}`,
          `  function(context, callback) {}`,
          `  (context, callback) => {}`,
          ``,
          `NOTE: "context" and "callback" are magic parameters populated at runtime by your execution environment,`,
          `they should always be the last parameters in your function definition when you want to access them,`,
          `and they will never be included in documentation.`,
          ``
        ].join('\n'));
      }
      return param;
    });
  }

  parse(name, fileString) {

    let moduleStatement = this.parseModuleExportsStatement(fileString);
    let functionExpression = this.parseFunctionExpressionFromModuleExportsStatement(moduleStatement);
    let comment = this.parseCommentFromModuleExportsStatement(moduleStatement);
    let commentDefinition = this.commentDefinitionParser.parse(name, comment);
    let functionDefinition = this.parseParamsFromFunctionExpression(functionExpression);

    let description = commentDefinition.description || '';
    let bg = commentDefinition.bg || background.generateDefaultValue();
    let charge = commentDefinition.charge || 1;
    let context = commentDefinition.context || functionDefinition.context;
    let acl = commentDefinition.acl;
    let isAsync = functionDefinition.async;
    let params = this.compareParameters(functionDefinition.params, commentDefinition.params);
    let returns = commentDefinition.returns;

    return {
      name: name,
      format: {
        language: this.language,
        async: isAsync
      },
      description: description,
      bg: bg,
      acl: acl,
      charge: charge,
      context: context,
      params: params,
      returns: returns
    };

  }

}

module.exports = ExportedFunctionParser;
