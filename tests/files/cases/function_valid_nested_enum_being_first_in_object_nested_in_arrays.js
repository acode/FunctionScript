/**
* Valid function with nested enums being first fields inside objects nested in arrays
* @param {?array} ruleSet The rules used to assign products to the collection.
* @ {object} obj desc stuff
* @   {enum} relation Specifies the relationship between the `column` and the condition.
*       ["CONTAINS", "CONTAINS"]
*       ["ENDS_WITH", "ENDS_WITH"]
*       ["EQUALS", "EQUALS"]
*       ["GREATER_THAN", "GREATER_THAN"]
*       ["IS_NOT_SET", "IS_NOT_SET"]
*       ["IS_SET", "IS_SET"]
*       ["LESS_THAN", "LESS_THAN"]
*       ["NOT_CONTAINS", "NOT_CONTAINS"]
*       ["NOT_EQUALS", "NOT_EQUALS"]
*       ["STARTS_WITH", "STARTS_WITH"]
* @param {?array} ruleSet2 The rules used to assign products to the collection.
* @ {object} obj desc stuff
* @   {enum} relation Specifies the relationship between the `column` and the condition.
*       ["CONTAINS", "CONTAINS"]
*       ["ENDS_WITH", "ENDS_WITH"]
*       ["EQUALS", "EQUALS"]
*       ["GREATER_THAN", "GREATER_THAN"]
*       ["IS_NOT_SET", "IS_NOT_SET"]
*       ["IS_SET", "IS_SET"]
*       ["LESS_THAN", "LESS_THAN"]
*       ["NOT_CONTAINS", "NOT_CONTAINS"]
*       ["NOT_EQUALS", "NOT_EQUALS"]
*       ["STARTS_WITH", "STARTS_WITH"]
* @   {boolean} appliedDisjunctively Whether products must match any
* @param {?array} anotherArray The rules used to assign products to the collection.
* @ {object} obj object desc
* @   {array} arr arr desc
* @     {object} obj2 obj2 desc
* @       {enum} opts options
*           ["OPTION_ONE", "OPTION_ONE"]
*           ["OPTION_TWO", "OPTION_TWO"]
* @       {object} obj3 obj3 desc
* @         {any} id id desc
* @         {array} arr2 Array description
* @           {object} obj3 object desc
* @             {enum} opt2 options2
*                 ["OPTION_ONE", "OPTION_ONE"]
*                 ["OPTION_TWO", "OPTION_TWO"]
* @returns {any} result
*/
module.exports = async (ruleSet = null, ruleSet2 = null, anotherArray = null, context) => {

  return {};

};
