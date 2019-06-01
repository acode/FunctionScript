# Gateway Demo

## Run local HTTP server

* Install the dependencies use `npm install` or `yarn` first.
* Run local HTTP server in `http://localhost:8000` by `npm start` or `yarn start`. Of cause `node ./index.js` is all right.
* Open [localhost:8000](http://localhost:8000)

## API

### `__main__.js` -> [`/`](http://localhost:8000)

A simple "hello world" function

```js
module.exports = async (name = 'world') => {
  return `Hello ${name}, I built this API with Code on Standard Library!`;
};
```

### `test.js` -> [`/test`](http://localhost:8000/test)

This is test function, it likes the greek alphabet

* `alpha`: `String` Some letters, I guess
* `beta`: `Number` And a number
* `gamma`: `Boolean` True or false?
* return a object with message.

```js
module.exports = async (alpha, beta = 2, gamma, context) => {
  /* your code */
  return {
    message: 'This is test function, it likes the greek alphabet'
  }
};
```

