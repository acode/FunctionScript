module.exports = {
  modes: {
    'info': (definition, params) => new Buffer(`Initiated ${definition.name}...`),
    'empty': (definition, params) => new Buffer(0),
    'params': (definition, params) => {
      let specifiedBgParams = definition.bg.value.split(' ');
      if (specifiedBgParams[0] === '') {
        return params;
      }
      let bgParams = {};
      for (var param in params) {
        if (params.hasOwnProperty(param) && specifiedBgParams.includes(param)) {
          bgParams[param] = params[param];
        }
      }
      return bgParams;
    }
  },
  defaultMode: 'info',
  generateDefaultValue: function () {
    return {
      mode: this.defaultMode,
      value: ''
    };
  }
};
