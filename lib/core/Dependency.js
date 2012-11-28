// Generated by CoffeeScript 1.4.0
var Dependency, RE_GITHUB_PROJECT, RE_GITHUB_URL, RE_INDEX, RE_PACKAGE_NOT_FOUND, RE_VALID_VERSION, async, bower, cp, existsSync, fs, http, mkdir, mv, notify, path, request, rm, semver, unzip, _ref,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

path = require('path');

fs = require('fs');

bower = require('bower');

request = require('superagent');

http = require('http');

unzip = require('unzip');

semver = require('semver');

async = require('async');

_ref = require('../utils/utils'), rm = _ref.rm, mv = _ref.mv, cp = _ref.cp, mkdir = _ref.mkdir, notify = _ref.notify, existsSync = _ref.existsSync;

RE_GITHUB_PROJECT = /\w+\/\w+/;

RE_GITHUB_URL = /git:\/\/(.*)\.git/;

RE_PACKAGE_NOT_FOUND = /was not found/;

RE_INDEX = /^index(?:\.js$)?/;

RE_VALID_VERSION = /^\d+\.\d+\.\d+$|^master$/;

module.exports = Dependency = (function() {

  function Dependency(source, destination, output, temp) {
    var _ref1;
    this.temp = temp;
    this.move = __bind(this.move, this);

    this.resolveResources = __bind(this.resolveResources, this);

    this.fetch = __bind(this.fetch, this);

    this.validateVersion = __bind(this.validateVersion, this);

    this.lookupPackage = __bind(this.lookupPackage, this);

    this.local = false;
    this.keep = false;
    this.id = source;
    this.name = source;
    this.url = null;
    this.version = 'master';
    this.location = null;
    this.resources = null;
    this.files = [];
    this.dependencies = [];
    this.destination = path.resolve(destination);
    this.output = output && path.resolve(output);
    source = source.split('#');
    if (source[1]) {
      this.resources = source[1].split('|');
    }
    if (existsSync(path.resolve(source[0]))) {
      this.local = true;
      this.location = path.resolve(source[0]);
      if ((_ref1 = this.resources) == null) {
        this.resources = [this.location];
      }
      this.keep = this.location.indexOf(path.resolve(this.destination)) !== -1;
    } else {
      source = source[0].split('@');
      if (source[1]) {
        this.version = source[1];
      }
      this.id = this.name = source[0];
      if (RE_GITHUB_PROJECT.test(this.name)) {
        this.url = "https://github.com/" + this.name + "/archive/" + this.version + ".zip";
        this.id = this.name.split('/')[1];
      }
    }
  }

  Dependency.prototype.install = function(fn) {
    var _this = this;
    if (this.local) {
      return this.move(function(err) {
        if (err) {
          return fn(err);
        } else {
          return fn(null, _this.dependencies);
        }
      });
    } else {
      return async.series([this.lookupPackage, this.validateVersion, this.fetch, this.resolveResources, this.move], function(err) {
        if (err) {
          return fn(err);
        } else {
          return fn(null, _this.dependencies);
        }
      });
    }
  };

  Dependency.prototype.lookupPackage = function(fn) {
    var _this = this;
    if (!this.url) {
      return bower.commands.lookup(this.id).on('error', function() {
        return fn('no package found for:' + _this.id);
      }).on('data', function(data) {
        var url;
        if (RE_PACKAGE_NOT_FOUND.test(data)) {
          return fn('no package found for:' + _this.id);
        } else {
          url = RE_GITHUB_URL.exec(data)[1];
          _this.name = url.replace('github.com/', '');
          _this.url = "https://" + url + "/archive/" + _this.version + ".zip";
          return fn();
        }
      });
    } else {
      return process.nextTick(function() {
        return fn();
      });
    }
  };

  Dependency.prototype.validateVersion = function(fn) {
    var req,
      _this = this;
    if (!RE_VALID_VERSION.test(this.version)) {
      req = request.get("https://api.github.com/repos/" + this.name + "/tags");
      return req.end(function(err, res) {
        var json, version, _i, _len;
        if (err || res.error) {
          return fn('fetching tags for: ' + _this.name + ' failed with error code: ' + http.STATUS_CODES[res.status]);
        } else {
          try {
            json = JSON.parse(res.text);
          } catch (err) {
            fn('parsing tag information for: ' + _this.name);
          }
          json.sort(function(a, b) {
            return semver.rcompare(a.name, b.name);
          });
          if (_this.version === '*' || _this.version === 'latest') {
            _this.version = json[0].name;
            _this.url = json[0].zipball_url;
          } else {
            for (_i = 0, _len = json.length; _i < _len; _i++) {
              version = json[_i];
              if (semver.satisfies(version.name, _this.version)) {
                _this.version = version.name;
                _this.url = version.zipball_url;
                break;
              }
            }
          }
          return fn();
        }
      });
    } else {
      return process.nextTick(function() {
        return fn();
      });
    }
  };

  Dependency.prototype.fetch = function(fn) {
    var filename, req,
      _this = this;
    filename = this.temp + path.sep + this.id + '-' + this.version + '.zip';
    req = request.get(this.url).buffer(false);
    return req.end(function(err, res) {
      if (err || res.error) {
        return fn('fetching ' + _this.url + ' failed with error code: ' + http.STATUS_CODES[res.status]);
      } else {
        res.pipe(fs.createWriteStream(filename));
        return res.on('end', function() {
          var extractor;
          extractor = unzip.Extract({
            path: _this.temp
          });
          fs.createReadStream(filename).pipe(extractor);
          extractor.on('error', function() {
            return fn('unzipping archive: ' + filename);
          });
          return extractor.on('close', function() {
            _this.location = filename.replace(path.extname(filename), '');
            return fn();
          });
        });
      }
    });
  };

  Dependency.prototype.resolveResources = function(fn) {
    var add, config, temp,
      _this = this;
    add = function(filename) {
      var filepath, newname;
      if (RE_INDEX.test(filename)) {
        if (!path.extname(filename)) {
          filename += '.js';
        }
        newname = _this.id + '.js';
        fs.renameSync(path.resolve(_this.location, filename), path.resolve(_this.location, newname));
        filename = newname;
      }
      filepath = path.resolve(_this.location, filename);
      if (existsSync(filepath)) {
        return _this.resources.push(filepath);
      }
    };
    if (this.resources) {
      temp = this.resources.concat();
      this.resources = [];
      temp.forEach(function(filename) {
        return add(filename);
      });
      return process.nextTick(function() {
        return fn();
      });
    } else {
      this.resources = [];
      if (existsSync(path.resolve(this.location, 'component.json'))) {
        config = 'component.json';
      } else if (existsSync(path.resolve(this.location, 'package.json'))) {
        config = 'package.json';
      } else {
        return fn('no config (component/package).json file found for: ' + this.id);
      }
      return fs.readFile(path.resolve(this.location, config), 'utf8', function(err, data) {
        var dependency, json, version, _ref1;
        if (err) {
          return fn('reading: ' + _this.id + ' ' + config);
        }
        try {
          json = JSON.parse(data);
        } catch (err) {
          return fn('parsing: ' + _this.id + ' ' + config);
        }
        if (json.dependencies) {
          _ref1 = json.dependencies;
          for (dependency in _ref1) {
            version = _ref1[dependency];
            _this.dependencies.push("" + dependency + "@" + version);
          }
        }
        if (json.scripts) {
          json.scripts.forEach(function(filename) {
            return add(filename);
          });
        } else if (json.main) {
          add(json.main);
        } else {
          return fn('unable to resolve resources for: ' + _this.id);
        }
        return fn(null);
      });
    }
  };

  Dependency.prototype.move = function(fn) {
    var idx,
      _this = this;
    if (!this.keep) {
      idx = -1;
      return async.forEachSeries(this.resources, (function(resource, cb) {
        return require('./utils')[_this.local ? 'cp' : 'mv'](resource, _this.destination, function(err, filepath) {
          if (err) {
            return cb(err);
          }
          idx++;
          _this.files.push(path.relative(process.cwd(), filepath));
          _this.resources[idx] = filepath;
          return cb();
        });
      }), function(err) {
        if (err) {
          return fn(err);
        } else {
          return fn();
        }
      });
    } else {
      return process.nextTick(function() {
        return fn();
      });
    }
  };

  Dependency.prototype.destroy = function() {};

  return Dependency;

})();