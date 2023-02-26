/**
* Valid function for streaming
* @param {string} alpha Some value
* @stream {string} hello Hello message
* @stream {string} goodbye Goodbye message
*/
module.exports = async (alpha, context) => {

  context.stream('hello', 'Hello?');
  context.stream('hello', 'How are you?');

  await new Promise(resolve => setTimeout(() => resolve(), 150));

  context.stream('hello', 'Is it me you\'re looking for?');

  await new Promise(resolve => setTimeout(() => resolve(), 250));

  context.stream('goodbye', 'Nice to see ya');

  return true;

};
