/**
* Valid function with an empty blacklist
* @returns {object}
*/
module.exports = (callback) => {

  let obj = {
    akey: 'avalue'
  }

  let spreadObj = {
    ...obj,
    hey: 'o'
  };
  
  return callback(null, spreadObj);

};
