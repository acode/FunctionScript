const mime = require('mime');
const background = require('../../background.js');

class StaticParser {

  constructor() {
    this.language = 'static';
  }

  parse (name, fileString, pathname, buffer) {

    let filename = pathname.split('/').pop();

    return {
      name: name,
      pathname: pathname,
      format: {
        language: this.language,
        async: false,
        inline: false
      },
      description: filename,
      metadata: {
        filename: filename,
        contentType: mime.getType(filename),
        contentLength: buffer.byteLength,
      },
      bg: background.generateDefaultValue(),
      keys: [],
      charge: 0,
      context: {},
      params: [
        {
          name: 'raw',
          description: 'turn off auto-formatting and return the raw file contents where applicable',
          type: 'boolean',
          defaultValue: false
        }
      ],
      returns: {
        name: 'file',
        description: 'Static File',
        type: 'object.http'
      }
    };

  }

}

module.exports = StaticParser;
