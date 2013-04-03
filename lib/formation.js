var formation = module.exports;

formation.BrowserSink = require('./sinks/browser');
formation.ConnectSink = require('./sinks/server');
formation.ConsoleSink = require('./sinks/console');
formation.FileSink = require('./sinks/file');

formation.Element = require('./element/element');
formation.FileCache = require('./element/filecache');
formation.JSObject = require('./element/jsobject');
formation.JSONFile = require('./element/jsonfile');
formation.Replacer = require('./element/replacer');
formation.TextFileCache = require('./element/textfilecache');
