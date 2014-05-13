// Generated by CoffeeScript 1.6.2
var config, fs, q, spawn, _;

_ = require('lodash');

q = require('q');

fs = require('fs');

spawn = require('child_process').spawn;

config = require('../core/config');

module.exports = function(args, options) {
  var child, defaults, deferred;

  deferred = q.defer();
  if (options == null) {
    options = {};
  }
  defaults = {
    cwd: process.cwd(),
    verbose: false
  };
  options = _.extend({}, defaults, options);
  child = spawn('git', args, _.omit(options, 'verbose'));
  child.on('exit', function(code) {
    var errMsg;

    if (code === 128) {
      errMsg = "git did not exit cleanly!";
      deferred.reject(errMsg);
      return console.log(errMsg);
    } else {
      return deferred.resolve(code);
    }
  });
  if (options.verbose) {
    child.stderr.on('data', function(data) {
      return console.log("\n" + (data.toString()));
    });
  }
  return deferred.promise;
};
