var clc = require('cli-color');

var ConsoleSink = function () {
};

ConsoleSink.log = function () {
  console.log.apply(console.log, arguments);
};

ConsoleSink.prototype.watch = function (figure) {
  var onDirty = function () {
    this.log(figure.name, 'dirty');
  }.bind(this);

  var onUpdate = function (data) {
    var out;
    if (Array.isArray(data)) {
      out = data.length + ' items';
    } else if (typeof data == "string") {
      out = data.length + ' chars';
    } else if (typeof data == "object") {
      out = Object.keys(data).length + ' keys';
    } else {
      out = data;
    }
    this.log(figure.name, 'update', out);
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

ConsoleSink.prototype.log = function (name, type, var_args) {
  var logArgs = [].slice.call(arguments, 2);
  var out = '<' + clc.black('cli') + ' (' + clc.blue(name) + ') ';
  switch (type) {
    case 'dirty':
      out += clc.yellow(type); break;
    case 'update':
      out += clc.green(type); break;
    default:
      out += type;
  }
  if (logArgs.length) {
    var logStr = logArgs.map(function (x) {return x + '';}).join(', ');
    out += ': ' + clc.black(logStr);
  }
  out += '>';
  ConsoleSink.log(out);
};

module.exports = ConsoleSink;
