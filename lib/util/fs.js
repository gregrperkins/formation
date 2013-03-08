var fs = require('graceful-fs');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var touch = require('touch');

// Proxy original functions we will override.
fs.watchFile_ = fs.watchFile;
fs.unwatchFile_ = fs.unwatchFile;
fs.readFile_ = fs.readFile;

// Store absolutely here, I can't see why it's a good idea
//  to use the given path as the identifier (like core does)...
// Map of absolute pathnames -> StatWatcherProxy's
fs.proxy_ = {};

/**
 * @constructor
 */
var StatWatcherProxy = function (absPath, options) {
  EventEmitter.call(this);
  this.path = absPath;

  this.onStop_ = this.emit.bind(this, 'stop');
  this.onChange_ = this.onChange.bind(this);

  this.statWatcher_ = fs.watchFile_(absPath, options, this.onChange_);
  this.statWatcher_.on('stop', this.onStop_);

  // When we should skip the next change event, store true here.
  this.skipNext_ = false;
}
util.inherits(StatWatcherProxy, EventEmitter);

StatWatcherProxy.prototype.dispose = function () {
  this.removeAllListeners();
  fs.unwatchFile_(this.path, this.onChange_);
};

StatWatcherProxy.prototype.trigger = function (current) {
  var previous = this.current_;
  var current = current || this.current_;
  this.current_ = current;
  this.skipNext_ = true;
  this.emit('change', current, previous);
};

StatWatcherProxy.prototype.onChange = function (current, previous) {
  this.current_ = current;
  if (this.skipNext_) {
    // console.log('Skipping');
    this.skipNext_ = false;
  } else {
    this.emit('change', current, previous);
  }
};


/**
 * We override fs.watchFile in order to facilitate predictably asynchronous
 *  watching behavior.
 * Specifically, we want to be sure that if we touch or write to a file, we
 *  emit a 'change' event on the next tick, rather than waiting for the libuv
 *  trigger to wake up.
 *
 * @see https://github.com/joyent/node/blob/master/lib/fs.js#L1074-1150
 */
fs.watchFile = function (filename, options, listener) {
  var absPath = path.resolve(filename);
  var proxy = fs.proxy_[absPath];
  if (!proxy) {
    proxy = fs.proxy_[absPath] = new StatWatcherProxy(filename, options);
  }
  proxy.on('change', listener);
  return proxy;
};

fs.unwatchFile = function (filename, listener) {
  // TODO(gregp): super untested...
  var abs = path.resolve(filename);
  var proxy = fs.proxy_[abs];

  if (!proxy) return;
  if (listener) {
    proxy.removeListener('change', listener);
  } else {
    proxy.dispose();
    fs.proxy_[abs] = undefined;
  }
};

fs.touch = function (filename, cb) {
  var abs = path.resolve(filename);
  var proxy = fs.proxy_[path.resolve(filename)];

  touch(filename, function (err) {
    if (err) return cb(err);
    if (proxy) proxy.trigger();
    cb();
  });
};

fs.touchReads_ = {};

fs.readFile = function (filename, opt_encoding, cb) {
  var absPath = path.resolve(filename);
  var enc;
  if (!cb) {
    cb = opt_encoding;
  } else {
    enc = enc;
  }
  // console.trace();
  fs.readFile_(absPath, enc, function (err, data) {
    cb(err, data);
    var pending = fs.touchReads_[absPath];
    if (!pending) return;
    // console.log('Pending', absPath, pending);
    while (pending.length) {
      var cur = pending.pop();
      cur();
    }
  });
};

// The supertouch is a touch that knows the file will be read,
//  and so does not call the callback until the next time readFile
//  is called on the given filename.
fs.supertouch = function (filename, cb) {
  var absPath = path.resolve(filename);
  fs.touch(filename, function (err) {
    if (err) return cb(err);

    if (!fs.touchReads_[absPath]) {
      fs.touchReads_[absPath] = [];
    }
    fs.touchReads_[absPath].push(cb);
  });
};


module.exports = fs;
