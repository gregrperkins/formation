var util = require('util');
var fs = require('fs');
var Element = require('../element/element');

/**
 * Watches an element and outputs it to the given path
 * Remember that it needs to have #init() called to work.
 *
 * @constructor
 * @param {Element|string} path
 * @param {Element} contentEl
 */
var FileSink = function (path, contentEl) {
  Element.call(this);

  var pathEl = (path instanceof PathElement) ? path : new PathElement(path);
  this.pathEl = pathEl;
  this.contentEl = contentEl;

  this.addChild(pathEl);
  this.addChild(contentEl);
};
util.inherits(FileSink, Element);
module.exports = FileSink;

/**
 * Override calculate so that we know the path and content are up to date
 * @override
 */
FileSink.prototype.calculate_ = function (cb) {
  var path = this.pathEl.cached;
  var content = this.contentEl.cached;
  fs.writeFile(path, content, cb);
};

/**
 * @param {string} path
 * @constructor
 */
var PathElement = function (path) {
  Element.call(this);
  this.path = path;
};
util.inherits(PathElement, Element);
PathElement.prototype.calculate_ = function (cb) {
  return cb(null, this.path);
};

FileSink.PathElement = PathElement;
