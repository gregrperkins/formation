var util = require('util');
var JSObject = require('./jsobject');
var TextFileCache = require('./textfilecache');

var JSONFile = function (path) {
  JSObject.call(this, new TextFileCache(path));
};
util.inherits(JSONFile, JSObject)

module.exports = JSONFile;
