var http = require('http');
var ecstatic = require('ecstatic');
var shoe = require('shoe');

var BrowserSink = function () {
  this.streams = {};

  /**
   * A counter for uniquely identifying streams.
   */
  this.streamCount_ = 0;

  /**
   * Keep an array of all the logs we've seen
   * TODO(gregp): remove unless testing?
   */
  this.logs = [];
};

/**
 * Create and register a new stream we will expect to output to.
 * @param {ReadableStream} stream
 */
BrowserSink.prototype.openStream = function (stream) {
  var cur = this.streamCount_++;
  this.streams[cur] = stream;
  // console.log('opened stream ' + cur + ' / ' + Object.keys(this.streams).length);
  stream.on('end', this.closeStream.bind(this, cur));

  // TODO(gregp): accept commands from frontend (rebuild, etc.)
  stream.on('data', function (data) {
    // process.stdout.write(data.toString());
    this.logs.push(data);
  }.bind(this));
  // stream.pipe(process.stdout, { end : false });
  // stream.pipe(this.logs, { end : false });
};


BrowserSink.prototype.closeStream = function (cur) {
  delete this.streams[cur];
  // console.log('closed stream ' + cur + ' / ' + Object.keys(this.streams).length);
};

BrowserSink.prototype._staticMW = function () {
  // TODO(gregp): use own static serve middleware
  // FIXME(gregp): move into subdir...
  return ecstatic(__dirname + '/../../example');
};
BrowserSink.prototype._sockInstall = function (server) {
  var sock = shoe(this.openStream.bind(this));
  return sock.install(server, '/out');
};

BrowserSink.prototype.expressify = function (app, server) {
  app.use(this._staticMW());
  this._sockInstall(server);
};

BrowserSink.prototype.init = function (port, cb) {
  var server = http.createServer(this._staticMW());
  server.listen(port);
  this._sockInstall(server);

  server.on('listening', function () {
    // console.log('BrowserSink serving on ' + this.port);
    cb && cb();
  }.bind(this));
};

BrowserSink.prototype.watch = function (figure, cb) {
  var onDirty = function () {
    this.write({
      type: 'dirty',
      name: figure.name
    });
  }.bind(this);

  var onUpdate = function (data) {
    this.write({
      type: 'update',
      name: figure.name,
      data: data
    });
  }.bind(this);

  var onRemove = function () {
    figure.removeListener('dirty', onDirty);
    figure.removeListener('update', onUpdate);
    figure.removeListener('remove', onRemove);
  };

  figure.on('dirty', onDirty);
  figure.on('update', onUpdate);
  figure.on('remove', onRemove);
};

BrowserSink.prototype.write = function (obj) {
  // console.log(Object.keys(this.streams).length);
  var str = JSON.stringify(obj);
  // console.log(str);
  var key;
  for (key in this.streams) {
    this.streams[key].write(str);
  }
};

module.exports = BrowserSink;
