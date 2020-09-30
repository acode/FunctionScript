/**
* Test Buffer Nested In Params
* @param {?object} upload
* @ {object} attributes The additional attributes of the file being uploaded. Mainly the name and the parent folder. These attributes are part of the multi part request body and are in JSON format.  The `attributes` part of the body must come before the `file` part. Requests that do not follow this format when uploading the file will receive a HTTP `400` error with a `metadata_after_file_contents` error code.
* @   {string} name An optional new name for the file. If specified, the file will be renamed when the new version is uploaded.
* @   {?string} content_modified_at Defines the time the file was last modified at. If not set, the upload time will be used.
* @ {buffer} file The content of the file to upload to Box.  The `attributes` part of the body must come before the `file` part. Requests that do not follow this format when uploading the file will receive a HTTP `400` error with a `metadata_after_file_contents` error code.
* @returns {?object} Files A list of files
*/
module.exports = async (upload = null) => {
  return {};
};
