/**
* Provides alternateSchemas
* @param {object} fileOrFolder
* @ {string} name
* @ {integer} size
* @ OR
* @ {string} name
* @ {array} files
* @ {object} options
* @   {string} type
* @   OR
* @   {number} type
* @returns {object} fileOrFolder
* @ {string} name
* @ {integer} size
* @ OR
* @ {string} name
* @ {array} files
* @ {object} options
* @   {string} type
* @   OR
* @   {number} type
*/
module.exports = async (fileOrFolder) => {

  return {name: 'hello', size: 100};

};
