var util = require('util');
var async = require('async');
var besync = require('besync');
var EventEmitter = require('events').EventEmitter;

var noop = function () {};

/**
 * The element is the basic building block of all formations.
 */
var Element = function () {
  EventEmitter.call(this);

  this.children = [];
  this.isInitialized = false;
  this.isDirty = true;
  this.lastDirty = 0;
  this.lastUpdated = 0;

  Object.defineProperty(this, 'name', {
    get: this.getName.bind(this)
  });

  // cached so we can unlisten
  this.dirty_ = this.dirty.bind(this, noop);
  this.update_ = this.update.bind(this, noop);
};
util.inherits(Element, EventEmitter);
module.exports = Element;

Element.prototype.getName = function () {
  return '[' + this.class + (this.name_ ? (' ' + this.name_) : '') + ']';
};

Element.prototype.class = 'Element';

Element.prototype.dirty = function (cb) {
  if (this.isDirty) return cb();
  // console.log('Element.prototype.dirty, ', this.name);
  this.isDirty = true;
  this.lastDirty = +new Date;
  this.emit('dirty');
  this.update(cb);
};

/**
 * This is called either when any child becomes dirty,
 *  when any child gets an update,
 *  or when a source otherwise changes such that we need to
 *  recalculate when all of our dependents are ready.
 * We might not be dirty:
 *  1. if there's a multiple dependency that updated us
 *      through another branch already.
 *  2. when we're initializing; our child updates will
 *      have caused us to update already.
 *
 * @param {function(Error=)} cb
 */
Element.prototype.update = function (cb) {
  if (!this.isDirty) {
    return cb();
  }

  // If children are still dirty, we can't remake yet...
  if (this.children.some(function (child) {return child.isDirty;})) {
    return cb();
  }

  besync.waterfall(cb, [
    this.calculate,
    this.updated,
  ], this);
};

Element.prototype.updated = function (val, next) {
  this.cached = val;
  this.isDirty = false;
  this.lastUpdated = +new Date;
  this.emit('update', this.cached);
  next();
};

/**
 * calculate() should assume the children are all updated!
 *  It should pass the value to our callback.
 */
Element.prototype.calculate = function (cb) {
  this.calculate_(function (err, val) {
    if (err) return cb(err);
    cb(null, val);
  }.bind(this));
};

/**
 * Override calculate_ to generate a value given all known child values.
 */
Element.prototype.calculate_ = function (cb) {
  var val = null;
  cb(null, val);
};

/**
 * Override init_ if there's anything that needs to be done to initialize,
 *  such as watching a file or polling an http endpoint.
 */
Element.prototype.init_ = function (cb) {
  cb();
};

/**
 * init() should only ever be called once.
 * We should ensure that all children are initialized before we are.
 *  then we should call init_() for any class specific behavior.
 * Then we should get our value generated with update().
 */
Element.prototype.init = function (cb) {
  if (this.isInitialized) return cb();

  besync.waterfall(cb, [
    this.initChildren,
    this.init_,
    function (next) {
      this.isInitialized = true;
      next();
    },
    this.update,
  ], this);

};

Element.prototype.initChildren = function (cb) {
  return async.forEach(this.children, function (child, next) {
    child.init(next);
  }, cb);
};

Element.prototype.addChild = function (figure) {
  this.children.push(figure);
  figure.on('dirty', this.dirty_);
  figure.on('update', this.update_);
};

Element.prototype.disposeInternal = function () {};
Element.prototype.dispose = function (cb) {
  if (!this.isDisposed) {
    this.disposeInternal();
    this.emit('remove');
    this.isDisposed = true;
  }
  cb && cb();
};

// Element.prototype.removeChild = function (figure) {
//   this.children = this.children.filter(function (x) {
//     return x != figure;
//   });
//   figure.removeListener('dirty', this.dirty_);
//   figure.removeListener('update', this.update_);
// };

