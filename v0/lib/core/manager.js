// Generated by CoffeeScript 1.6.2
var Dependency, EventEmitter, Manager, exec, template, _,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = require('events').EventEmitter;

Dependency = require('./dependency');

_ = require('../util/lodash-ext');

template = require('../util/template');

exec = require('child_process').exec;

Manager = (function(_super) {
  __extends(Manager, _super);

  function Manager(dependencies, options) {
    var depObj, dependency, _i, _len;

    this.config = {
      dependencies: dependencies || [],
      options: options || {}
    };
    this.tickers = {};
    this.dependencies = [];
    for (_i = 0, _len = dependencies.length; _i < _len; _i++) {
      depObj = dependencies[_i];
      options = _.omit(depObj, 'src');
      dependency = new Dependency(depObj.src, options);
      this.dependencies.push(dependency);
      dependency.on('data', this.emit.bind(this, 'data')).on('error', this.emit.bind(this, 'error'));
    }
  }

  Manager.prototype.resolve = function() {
    var dependency, _i, _len, _ref, _results,
      _this = this;

    this.runScript('preresolve');
    this.on('resolved', function() {
      return _this.runScript('postresolve');
    });
    _ref = this.dependencies;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      dependency = _ref[_i];
      if (dependency.isCached()) {
        if (this.config.options.update) {
          _results.push(dependency.update(function() {
            return _this.tick('resolved');
          }));
        } else {
          _results.push(this.tick('resolved'));
        }
      } else {
        _results.push(dependency.cache().then(function() {
          return _this.tick('resolved');
        }));
      }
    }
    return _results;
  };

  Manager.prototype.install = function() {
    var dependency, _i, _len, _ref, _results,
      _this = this;

    this.runScript('preinstall');
    this.on('installed', function() {
      return _this.runScript('postinstall');
    });
    _ref = this.dependencies;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      dependency = _ref[_i];
      _results.push(dependency.copy(function() {
        return _this.tick('installed');
      }));
    }
    return _results;
  };

  Manager.prototype.update = function() {
    var dependency, _i, _len, _ref, _results,
      _this = this;

    _ref = this.dependencies;
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      dependency = _ref[_i];
      _results.push(dependency.update(function() {
        return _this.tick('updated');
      }));
    }
    return _results;
  };

  Manager.prototype.runScript = function(scriptName) {
    var line, _ref,
      _this = this;

    if ((line = (_ref = this.config.options.scripts) != null ? _ref[scriptName] : void 0) != null) {
      return exec(line, function(err, stdout, stderr) {
        if (err != null) {
          _this.emit('error', err);
        }
        if (stderr != null ? stderr.length : void 0) {
          _this.emit('error', stderr);
        }
        if (stdout != null ? stdout.length : void 0) {
          _this.emit('data', stdout);
        }
        return template('script', {
          which: scriptName,
          command: line
        }).on('data', _this.emit.bind(_this, 'data'));
      });
    }
  };

  Manager.prototype.tick = function(eventName, emitArg, cb) {
    var _base, _ref;

    if ((_ref = (_base = this.tickers)[eventName]) == null) {
      _base[eventName] = 0;
    }
    if ((emitArg != null) && typeof emitArg === 'function') {
      cb = emitArg;
      emitArg = void 0;
    }
    if (++this.tickers[eventName] === this.dependencies.length) {
      this.tickers[eventName] = 0;
      this.emit(eventName, emitArg || 0);
      return typeof cb === "function" ? cb() : void 0;
    }
  };

  return Manager;

})(EventEmitter);

module.exports = Manager;
