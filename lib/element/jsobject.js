var util = require('util');
var Element = require('./element');
require('../json-minify');

/**
 * Converts a json string into a js object.
 */
var JSObject = function (strElement) {
  Element.call(this);
  this.strElement = strElement;
  this.addChild(strElement);
};
util.inherits(JSObject, Element);
module.exports = JSObject;

JSObject.prototype.class = "JSObject";

JSObject.prototype.calculate_ = function (cb) {
  var val = this.strElement.cached;
  var norm = JSON.parse(JSON.minify(val.toString()));
  return cb(null, norm);
};
