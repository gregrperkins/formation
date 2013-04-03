var besync = require('besync');
var Browser = require('zombie');
var ecstatic = require('ecstatic');
var express = require('express');
var fs = require('../lib/util/fs');
var funct = require('funct');
var http = require('http');
var racetrack = require('racetrack');
var should = require('shoulda');
var temp = require('temp');
var trim = require('cli-color/lib/trim');
var util = require('util');

var formation = require('../lib/formation');

describe('formation', function () {
  racetrack.mochaHook();
  var fns = {
    'on': false,
    'once': false,
    'removeListener': false,
    'addChild': false,
    'removeChild': false,

    'dirty_': true,
    'update_': true
  };
  var silentTracer_ = {fns: fns};
  var tracer_ = {
    print: true, indent: 2,
    // printCallbacks: true,
    fns: fns
  };

  describe('TextFileCache', function () {
    it('initializes', function (done) {
      var assetsJson = new formation.TextFileCache('./example/assets.json');
      // racetrack.configure(assetsJson, silentTracer_);

      assetsJson.init(function () {
        should.ok(assetsJson.isInitialized);
        should.ok(!assetsJson.isDirty);
        done();
      });
    })
  });

  describe('JSObject', function () {
    it('initializes', function (done) {
      var assetsJson = new formation.TextFileCache('./example/assets.json');
      var assetsObject = new formation.JSObject(assetsJson);

      assetsObject.toString = function () {return 'assetsObject'};
      assetsJson.toString = function () {return 'assetsJson'};
      racetrack.configure(assetsObject, silentTracer_);
      racetrack.configure(assetsJson, silentTracer_);

      assetsObject.init(function () {
          should.equal(assetsJson.isInitialized, true);
          should.equal(assetsObject.isInitialized, true);
        done();
      });
    })

    it('only initializes once', function (done) {
      var assetsJson = new formation.TextFileCache('./example/assets.json');
      var assetsObject = new formation.JSObject(assetsJson);

      assetsObject.toString = function () {return 'assetsObject'};
      assetsJson.toString = function () {return 'assetsJson'};
      racetrack.configure(assetsObject, silentTracer_);
      racetrack.configure(assetsJson, silentTracer_);

      should.equal(assetsJson.isInitialized, false);
      should.equal(assetsObject.isInitialized, false);

      var outerCount = 0;
      var checkInitialized = function (next) {
        // Both should be initialized.
        should.equal(assetsJson.isInitialized, true);
        should.equal(assetsObject.isInitialized, true);
        // We should only init the inner dependency once.
        should.exist(assetsJson.init.calls);
        assetsJson.init.calls.should.have.length(1);
        // We should init the outer dependency once per init call, obviously.
        should.exist(assetsObject.init.calls);
        assetsObject.init.calls.should.have.length(++outerCount);
        // But we should *calulate* the outer dep only once.
        should.exist(assetsObject.calculate.calls);
        assetsObject.calculate.calls.should.have.length(1);
        next();
      };

      besync.waterfall(done, [
        assetsObject.init,
        checkInitialized,
        assetsObject.init,
        checkInitialized,
      ], assetsObject);
    });
  });

  describe('Element', function () {
    it('updates when a child updates', function (done) {
      var parent = new formation.Element();
      var child = new formation.Element();
      // console.log();
      // racetrack.configure(parent, tracer_);
      parent.addChild(child);
      var calculations = 0;
      parent.calculate_ = function (cb) {
        calculations++;
        cb(null, 'a' + child.cached);
      };
      child.calculate_ = function (cb) {
        cb(null, calculations);
      };
      parent.init(function (err) {
        if (err) return done(err);
        child.cached.should.equal(0);
        parent.cached.should.equal('a0');
        calculations.should.equal(1);

        // Can't just pass as a callback to dirty: EventEmitter isn't async
        parent.once('update', function () {
          calculations.should.equal(2);
          parent.cached.should.equal('a1');
          done();
        });

        child.dirty(function (err) {
          if (err) return done(err);
        });
      });
    });

    it('only updates once when a child updates twice fast', function (done) {
      var parent = new formation.Element();
      var child = new formation.Element();
      // console.log();
      // racetrack.configure(parent, tracer_);
      parent.addChild(child);

      var initDone = false;
      var pendingCb = null;
      var calculations = 0;
      parent.calculate_ = function (cb) {
        calculations++;
        if (initDone && pendingCb) {
          done(new Error('calculated twice before cb finished.'));
        } else if (initDone) {
          pendingCb = cb;
          // console.log('Pended cb, first calculation waiting...');
        } else {
          // console.log('First calculation done');
          cb();
        }
      };

      parent.init(function (err) {
        if (err) return done(err);
        calculations.should.equal(1);
        initDone = true;

        // Can't just pass as a callback to dirty: EventEmitter isn't async
        parent.on('update', function () {
          // console.log('all done, update finished');
          calculations.should.equal(2);
          done();
        });

        child.on('update', function () {
          // console.log('child updating');
        });

        // console.log('first child dirtying');
        child.dirty(function (err) {
          // console.log('first child dirty happened');
          if (err) return done(err);
          // console.log('second child dirtying');
          child.dirty(function (err) {
            // console.log('second child dirty happened');
            if (err) return done(err);
            if (!pendingCb) return done('Weird error');
            return pendingCb();
          });
        });
      });
    });
  });


  var Replacer = function (source, assets) {
    formation.Replacer.call(this, source);
    this.assets = assets;
    this.addChild(this.assets);
  };
  util.inherits(Replacer, formation.Replacer);

  Replacer.prototype.class = "Replacer";

  Replacer.prototype.replacements_ = function (cb) {
    cb(null, {'SDK': 'SDK'});
  };

  Replacer.prototype.value_ = function (val) {
    return 'ASSET.' + this.assets.cached[val].key;
  };


  it('initializes', function(done) {
    var assetsJson = new formation.TextFileCache('./example/assets.json');
    var assetsObject = new formation.JSObject(assetsJson);
    var moduleWrapper = new formation.TextFileCache('./example/module.js');
    var moduleReplacer = new Replacer(moduleWrapper, assetsObject);

    assetsJson.toString = function () {return 'assetsJson';};
    assetsObject.toString = function () {return 'assetsObject';};
    moduleWrapper.toString = function () {return 'moduleWrapper';};
    moduleReplacer.toString = function () {return 'moduleReplacer';};
    racetrack.configure(
      [assetsObject, assetsJson, moduleWrapper, moduleReplacer],
      silentTracer_
    );

    besync.waterfall(done, [
      moduleReplacer.init.bind(moduleReplacer),
      function (next) {
        should.ok(assetsJson.isInitialized);
        should.ok(assetsObject.isInitialized);
        should.ok(moduleWrapper.isInitialized);
        should.ok(moduleReplacer.isInitialized);
        moduleReplacer.cached.should.include('ASSET.SDK');
        next();
      }
    ]);
  });

  // Slow test because we have to wait for the web socket to open
  it('console and browser sinks have expected log output', function(done) {
    var assetsJson = new formation.TextFileCache('./example/assets.json');
    var assetsObject = new formation.JSObject(assetsJson);
    var moduleWrapper = new formation.TextFileCache('./example/module.js');
    var moduleReplacer = new Replacer(moduleWrapper, assetsObject);

    var port = Math.floor(Math.random() * 30000 + 12000);

    var bs = new formation.BrowserSink();
    var cs = new formation.ConsoleSink();
    var app = express();

    var startExpressApp = function(port, cb) {
      var server = app.listen(port);
      bs.expressify(app, server);
      server.on('listening', cb);
    };

    assetsJson.toString = function () {return 'assetsJson';};
    assetsObject.toString = function () {return 'assetsObject';};
    moduleWrapper.toString = function () {return 'moduleWrapper';};
    moduleReplacer.toString = function () {return 'moduleReplacer';};
    racetrack.configure(
      [moduleWrapper, moduleReplacer, assetsObject, assetsJson],
      silentTracer_
    );

    var browser = new Browser();
    // Shut up the console reporter.
    browser.removeAllListeners('console');

    var logs = [];
    formation.ConsoleSink.log = function () {
      logs.push([].slice.call(arguments).map(trim));
      // console.log.apply(console, arguments);
    };

    var visitUrl = function (next) {
      var url = 'http://localhost:' + port + '/';
      // console.log('Browser trying to connect to ' + url);
      browser.visit(url, next);
    };

    var watchAndTouch = function (next) {
      bs.watch(assetsJson);
      bs.watch(moduleWrapper);
      bs.watch(moduleReplacer);
      bs.watch(assetsObject);

      cs.watch(assetsJson);
      cs.watch(assetsObject);
      cs.watch(moduleWrapper);
      cs.watch(moduleReplacer);

      // console.log(new Array(70).join('-'));
      fs.supertouch('./example/assets.json', next);
    };

    var checkConsole = function (next) {
      // console.log(new Array(70).join('-'));
      logs.should.eql([
        // Dirty messages cascade; we may get them potentially in random order.
        ['<cli ([Replacer]) dirty>'],
        ['<cli ([JSObject]) dirty>'],
        ['<cli ([TextFileCache ./example/assets.json]) dirty>'],
        ['<cli ([TextFileCache ./example/assets.json]) update: 661 chars>'],
        ['<cli ([JSObject]) update: 5 keys>'],
        ['<cli ([Replacer]) update: 71 chars>'],
      ]);

      next();
    };

    var registerConsoleCheck = function (next) {
      moduleReplacer.on('update', function () {
        process.nextTick(checkConsole.bind(this, next));
      });
    };

    var checkBrowser = function (next) {
      // Should have 1 socket open
      Object.keys(bs.streams).should.have.length(1);

      // Check that we got some good stuff back from the browser
      bs.logs.should.eql([
        '<browser ([Replacer]) dirty: 36 bytes>\n',
        '<browser ([JSObject]) dirty: 36 bytes>\n',
        '<browser ([TextFileCache ./example/assets.json]) dirty: 63 bytes>\n',
        '<browser ([TextFileCache ./example/assets.json]) update: 872 bytes>\n',
        '<browser ([JSObject]) update: 534 bytes>\n',
        '<browser ([Replacer]) update: 125 bytes>\n',
      ]);

      next();
    };

    var dispose = function (next) {
      besync.waterfall(next, [
        assetsJson.dispose.bind(assetsJson),
        moduleWrapper.dispose.bind(moduleWrapper),
        moduleReplacer.dispose.bind(moduleReplacer),
        assetsObject.dispose.bind(assetsObject),
      ], this);
    };

    besync.waterfall(done, [
      moduleReplacer.init.bind(moduleReplacer),
      moduleWrapper.init.bind(moduleWrapper),
      assetsJson.init.bind(assetsJson),
      // bs.init.bind(bs, port),
      startExpressApp.bind(this, port),
      visitUrl,
      funct.dropAll,
      watchAndTouch,
      funct.dropAll,
      registerConsoleCheck,
      function (next) {
        // Zombie takes a few ms to catch up...
        setTimeout(next, 5);
      },
      checkBrowser,
      dispose,
    ]);
  });

  // TODO(gregp): test two browser streams at once?

  // Slow test because we have to wait for the web socket to open
  it('server sink can push a simple text file', function(done) {
    var moduleWrapper = new formation.TextFileCache('./example/module.js');

    var port = Math.floor(Math.random() * 30000 + 12000);
    var url = 'http://localhost:' + port + '/serversink.html';

    var ss = formation.ConnectSink(moduleWrapper);
    var app = express();
    var server = app.listen(port);
    app.use('/hi.js', ss);
    app.use('/', ecstatic(__dirname + '/statics'));

    moduleWrapper.toString = function () {return 'moduleWrapper';};
    racetrack.configure(moduleWrapper, silentTracer_);

    var browser = new Browser();
    browser.removeAllListeners('console');

    var visitUrl = function (next) {
      // console.log('Browser trying to connect to ' + url);
      browser.visit(url, next);
    };

    var checkJsLoaded = function (next) {
      // console.log(browser.resources[1].response.body.toString());
      should.ok(browser.window.MODULE_DOT_JS_LOADED, 'js not loaded...');
      next();
    };

    server.on('listening', function () {
      return besync.waterfall(done, [
        moduleWrapper.init,
        visitUrl,
        funct.dropAll,
        checkJsLoaded,
        dispose,
      ], moduleWrapper);
    });

    var dispose = function (next) {
      moduleWrapper.dispose(next);
    };
  });

  describe('FileSink', function () {
    var moduleWrapper = new formation.TextFileCache('./example/module.js');
    var sink, path;
    beforeEach(function (done) {
      temp.open('modWrap', function(err, info) {
        fs.close(info.fd, function(err) {
          path = info.path;
          sink = new formation.FileSink(path, moduleWrapper);
          sink.init(done);
        });
      });
    });

    it('writes the expected content', function (done) {
      fs.readFile(path, function (err, data) {
        data.toString().should.equal(moduleWrapper.cached);
        done();
      });
    });

    it('updates dynamagically', function (done) {
      fs.readFile(path, function (err, data) {
        data.toString().should.equal(moduleWrapper.cached);
        moduleWrapper.emit('dirty');
        moduleWrapper.cached = 'poop';
        moduleWrapper.emit('update');
        setTimeout(function () {
          fs.readFile(path, function (err, data) {
            data.toString().should.equal('poop');
            done();
          });
        }, 0);
      });
    });
  });
});

