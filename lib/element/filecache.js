var util = require('util');
var fs = require('../util/fs');
var Element = require('./element');

var FileCache = function (filePath) {
  Element.call(this);
  this.filePath = filePath;
  this.name_ = filePath;
};
util.inherits(FileCache, Element);
module.exports = FileCache;

FileCache.interval = 100;

// TODO(gregp): handle deletion
// FileCache.prototype.onChange = function () {

FileCache.prototype.class = 'FileCache';

/**
 * Override this function to change the behavior
 * @param {Buffer} data
 */
FileCache.prototype.interpretFile_ = function(data, cb) {
  return cb(null, data);
};

FileCache.prototype.calculate_ = function (cb) {
  fs.readFile(this.filePath, function (err, data) {
    if (err) return cb(err);
    this.interpretFile_(data, cb);
  }.bind(this));
};

FileCache.prototype.init_ = function (cb) {
  fs.watchFile(
    this.filePath,
    {persistent: true, interval: FileCache.interval},
    this.dirty_);
  cb();
};

FileCache.prototype.disposeInternal = function (cb) {
  refs[this.filePath]--;
  if (refs[this.filePath] == 0) {
    delete map[this.filePath];
  }
  fs.unwatchFile(this.filePath);
};


var map = {};
var refs = {};
FileCache.get = function (filePath) {
  var obj = map[filePath];
  if (obj) {
  } else {
    obj = new FileCache(filePath);
    map[filePath] = obj;
  }
  refs[filePath]++;
  return obj;
};
