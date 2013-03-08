var util = require('util');
var FileCache = require('./filecache');

var TextFileCache = function (filePath) {
  FileCache.call(this, filePath);
};
util.inherits(TextFileCache, FileCache);
module.exports = TextFileCache;

TextFileCache.prototype.class = 'TextFileCache';
TextFileCache.prototype.interpretFile_ = function (data, cb) {
  return cb(null, data.toString());
};
