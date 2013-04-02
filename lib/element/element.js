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
  this.isUpdating = false;
  this.lastDirty = +new Date;
  this.lastUpdated = 0;

  Object.defineProperty(this, 'name', {
    get: this.getName.bind(this)
  });

  // cached so we can unlisten
  this.dirty_ = function () {
    this.dirty(noop);
  }.bind(this);
  this.update_ = function () {
    this.update(noop);
  }.bind(this);
};
util.inherits(Element, EventEmitter);
module.exports = Element;

Element.prototype.getName = function () {
  return '[' + this.class + (this.name_ ? (' ' + this.name_) : '') + ']';
};

Element.prototype.class = 'Element';

/**
 * Called when this element becomes dirty, generally due to a child
 *  or watched file (in the case of FileCache) becoming dirty.
 * We first indicate the new last-dirty time, then either emit dirty
 *  and cause an update
 *
 * @param {function(Error=)} cb
 */
Element.prototype.dirty = function (cb) {
  this.lastDirty = +new Date;
  if (this.isDirty || this.isUpdating) {
    // We were already dirty, so we're already updating, so we should
    //  wait until that update is complete to start a new one
    // TODO(gregp): cancel and restart the update instead?
    return cb();
  }

  // console.log('Element.prototype.dirty, ', this.name);
  this.isDirty = true;
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
  if (!this.isDirty || this.isUpdating) {
    return cb();
  }

  // If children are still dirty, we can't remake yet...
  if (this.children.some(function (child) {return child.isDirty;})) {
    return cb();
  }

  this.isUpdating = true;
  // lastUpdated time must be locked *before* we start calculating
  this.lastUpdated = +new Date;
  besync.waterfall(cb, [
    this.calculate,
    this.registerUpdate,
  ], this);
};

/**
 * Register the newly updated value as the cached value here,
 *  then either complete the update cycle (if the value has not been
 *  dirtied in the meantime) or else update the value again.
 *
 * @param {*} val
 * @param {function(Error=)} cb
 */
Element.prototype.registerUpdate = function (val, cb) {
  this.isUpdating = false;
  this.cached = val;

  // console.log('registerUpdate with ', this.lastUpdated, this.lastDirty);
  if (this.lastUpdated >= this.lastDirty) {
    // current time is after the last change of a dependent, done updating.
    this.isDirty = false;
    this.emit('update', this.cached);
    cb();
  } else {
    this.update(cb);
  }
};

/**
 * calculate() should assume the children are all updated!
 *  It should pass the value to our callback.
 * @param {function(Error=, *)} cb
 */
Element.prototype.calculate = function (cb) {
  this.calculate_(function (err, val) {
    if (err) return cb(err);
    cb(null, val);
  }.bind(this));
};

/**
 * Override calculate_ to generate a value given all known child values.
 * @param {function(Error=, *)} cb
 */
Element.prototype.calculate_ = function (cb) {
  var val = null;
  cb(null, val);
};

/**
 * init() should only ever be called once.
 * We should ensure that all children are initialized before we are.
 *  then we should call init_() for any class specific behavior.
 * Then we should get our value generated with update().
 *
 * @param {function(Error=)} cb - Once the initialization is complete.
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

/**
 * Override init_ if there's anything that needs to be done to initialize,
 *  such as watching a file or polling an http endpoint.
 * @param {function(Error=)} cb
 */
Element.prototype.init_ = function (cb) {
  cb();
};

/**
 * Initialize all the children
 * @param {function(Error=)} cb
 */
Element.prototype.initChildren = function (cb) {
  return async.forEach(this.children, function (child, next) {
    child.init(next);
  }, cb);
};

/**
 * Add a given element as a child, IE: whenever it becomes dirty this
 *  element may need to be recalculated.
 * TODO(gregp): filter dirty and update events based on whether they
 *  actually require a recalculation?
 *
 * @param {Element} element - The child element
 */
Element.prototype.addChild = function (element) {
  this.children.push(element);
  element.on('dirty', this.dirty_);
  element.on('update', this.update_);
};

/**
 * To be overridden when there is more complex disposal logic
 */
Element.prototype.disposeInternal = function () {};

/**
 * Prepare this element for garbage collection. Emit a "remove" event.
 * @param {function(Error=)} cb
 */
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

