/**
* Valid function for streaming
* @param {string} alpha Some value
* @stream {string} hello Hello message
* @stream {string} goodbye Goodbye message
*/
module.exports = async (alpha, context) => {

  context.stream('hello', 'Hello?');
  context.stream('hello', 'How are you?');
  console.log('what?', 'who?');

  await new Promise(resolve => setTimeout(() => resolve(), 20));

  context.stream('hello', 'Is it me you\'re looking for?');
  console.error('oh no');

  await new Promise(resolve => setTimeout(() => resolve(), 20));

  context.stream('goodbye', 'Nice to see ya');
  console.log('finally');

  return true;

};
