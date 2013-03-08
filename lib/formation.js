var formation = module.exports;

formation.BrowserSink = require('./sinks/browser');
formation.ConsoleSink = require('./sinks/console');
formation.ConnectSink = require('./sinks/server');

formation.Element = require('./element/element');
formation.FileCache = require('./element/filecache');
formation.JSObject = require('./element/jsobject');
formation.JSONFile = require('./element/jsonfile');
formation.Replacer = require('./element/replacer');
formation.TextFileCache = require('./element/textfilecache');
