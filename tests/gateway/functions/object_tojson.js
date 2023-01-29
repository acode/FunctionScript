class MyClass {

  constructor (name = '?') {
    this.name = name;
  }

  toJSON () {
    return {
      name: this.name,
      description: this.constructor.name
    };
  }

}

/**
* @returns {any}
*/
module.exports = async () => {

  let obj = new MyClass('hello world');

  return obj;

};
