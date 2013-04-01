var util = require('util');
var Element = require('./element');

var Replacer = function (src) {
  Element.call(this);
  this.src = src;
  this.addChild(src);
};
util.inherits(Replacer, Element);

Replacer.prototype.class = "Replacer";

Replacer.prototype.calculate_ = function (cb) {
  var val = this.src.cached;
  this.replacements_(function (err, replacements) {
    Object.keys(replacements).forEach(function (key) {
      val = val.replace(this.pattern_(key), this.value_(replacements[key]));
    }.bind(this));
  }.bind(this));
  cb(null, val);
};

/**
 * Override this to change how the keys are transformed into regexes
 *  to be matched against the source text.
 *
 * By default, looks like /.** @replace "KeyName" *./ without the dots
 *
 * @blocking
 */
Replacer.prototype.pattern_ = function (key) {
  return new RegExp('/\\*\\*\\s*@replace\\s*"' + key + '"\\s*\\*/', 'g');
};

/**
 * Override this to change how the values in the replacement map are
 *  transformed into strings to inject into the source text.
 * @blocking
 */
Replacer.prototype.value_ = function (item) {
  return item.cached;
};

/**
 * Override this to change what replacements are made in the source txt.
 */
Replacer.prototype.replacements_ = function (cb) {
  cb(null, {});
};

module.exports = Replacer;
