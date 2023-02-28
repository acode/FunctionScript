/**
* Not a streaming function, can debug with streaming
* @param {string} alpha Some value
*/
module.exports = async (alpha, context) => {

  console.log('what?', 'who?');

  await new Promise(resolve => setTimeout(() => resolve(), 20));

  console.error('oh no');

  await new Promise(resolve => setTimeout(() => resolve(), 20));

  console.log('finally');

  return true;

};
