var path = require('path')
	, fs = require('fs')
	, rimraf = require('rimraf')
	, should = require('should')
	, Builder = require('../lib/builder')
	, configuration = require('../lib/core/configuration');

term = require('buddy-term').silent = true;

function gatherFiles (dir, files) {
	files = files || [];
	for (var item in fs.readdirSync(dir)) {
		var p = path.resolve(dir, item);
		if (fs.statSync(p).isFile()) {
			files.push(p);
		} else {
			gatherFiles(p, files);
		}
	}
	return files;
}

describe('Builder', function() {
	beforeEach(function() {
		this.builder = new Builder();
	});
	afterEach(function() {
		this.builder = null;
		rimraf.sync(path.resolve('output'));
	});

	describe('parsing build target', function() {
		before(function() {
			process.chdir(path.resolve(__dirname, 'fixtures/builder/init'));
		});
		it('should result in a target count of 1 for valid target data', function() {
			this.builder._initializeTargets([{'input': 'target/foo.js', 'output': 'main.js'}]);
			this.builder.targets.should.have.length(1);
		});
		it('should result in a target count of 2 with valid target data containing a child target', function() {
			this.builder._initializeTargets([{'input': 'target/foo.js', 'output': 'main.js', 'hasChildren': true, 'targets':[{'input':'target/lib', 'output':'../js'}]}]);
			this.builder.targets.should.have.length(2);
		});
	});

	describe('building file targets', function() {
		before(function() {
			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project'));
		});
		describe('with a single coffee file', function() {
			it('should build 1 js file', function(done) {
				this.builder.build('buddy_single-file.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					done();
				}.bind(this));
			});
		});
		describe('with a single coffee file requiring 1 dependency', function() {
			it('should build 1 js file with 2 modules', function(done) {
				this.builder.build('buddy_single-file-with-dependency.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					var contents = fs.readFileSync(this.builder.targets[0].outputPaths[0], 'utf8');
					contents.should.include("require.register('package/class'");
					contents.should.include("require.register('package/classcamelcase'");
					done();
				}.bind(this));
			});
		});
		describe('with a single coffee file containing a module wrapper', function() {
			it('should build 1 js file containing only 1 module wrapper', function(done) {
				this.builder.build('buddy_single-file-with-wrapper.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					var contents = fs.readFileSync(this.builder.targets[0].outputPaths[0], 'utf8');
					contents.indexOf('require.register').should.eql(contents.lastIndexOf('require.register'));
					done();
				}.bind(this));
			});
		});
		describe('with a single livescript file', function() {
			it('should build 1 js file', function(done) {
				this.builder.build('buddy_single-ls-file.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					done();
				}.bind(this));
			});
		});
		describe('with a single handlebars template file', function() {
			it('should build 1 js file', function(done) {
				this.builder.build('buddy_single-handlebars-file.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					done();
				}.bind(this));
			});
		});
		describe('with a single stylus file', function() {
			it('should build 1 css file', function(done) {
				this.builder.build('buddy_single-styl-file.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					done();
				}.bind(this));
			});
		});
		describe('with a single less file', function() {
			it('should build 1 css file', function(done) {
				this.builder.build('buddy_single-less-file.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					done();
				}.bind(this));
			});
		});
	});

	describe('building directory targets', function() {
		before(function() {
			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/library'));
		});
		describe('with 3 coffee files', function() {
			it('should build 3 js files', function(done) {
				this.builder.build('buddy.js', {}, function(err) {
					var files = this.builder.targets[0].outputPaths;
					files.should.have.length(3);
					files.forEach(function(file) {
						fs.readFileSync(file, 'utf8').should.include('require.register(');
					});
					done();
				}.bind(this));
			});
		});
		describe('with 3 coffee files and the "modular" property set to false', function() {
			it('should build 3 js files without module wrappers', function(done) {
				this.builder.build('buddy-nodejs.js', {}, function(err) {
					var files = this.builder.targets[0].outputPaths;
					files.should.have.length(3);
					files.forEach(function(file) {
						fs.readFileSync(file, 'utf8').should.not.include('require.register(');
					});
					done();
				}.bind(this));
			});
		});
		describe('with 2 stylus files', function() {
			it('should build 2 css files', function(done) {
				this.builder.build('buddy_styl.js', {}, function(err) {
					var files = this.builder.targets[0].outputPaths;
					files.should.have.length(2);
					done();
				}.bind(this));
			});
		});
	});

	describe('building a project', function() {
		before(function() {
			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project'));
		});
		describe('with a single coffee file and a stylus directory', function() {
			it('should build 1 concatenated js file and 2 css files', function(done) {
				this.builder.build('buddy.js', {}, function(err) {
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					this.builder.targets[1].outputPaths.should.have.length(2);
					done();
				}.bind(this));
			});
		});
	});

	describe('building a partial project', function() {
		before(function() {
			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project-partial'));
		});
		describe('with a single coffee file and a missing stylus directory', function() {
			it('should build 1 concatenated js file ', function(done) {
				this.builder.build('buddy.js', {}, function(err) {
					should.not.exist(err);
					fs.existsSync(this.builder.targets[0].outputPaths[0]).should.be.true;
					done();
				}.bind(this));
			});
		});
	});
});
	// 	describe 'complex project', ->
	// 		before ->
	// 			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project-complex'))
	// 		describe 'with 2 js targets and 1 child target sharing assets', ->
	// 			it 'should build 3 concatenated js files', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					gatherFiles(path.resolve('output')).should.have.length(3)
	// 					done()
	// 			it 'should build a child js file without source shared with it`s parent', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					contents = fs.readFileSync(path.resolve('output/section.js'), 'utf8')
	// 					contents.should.not.include("require.module('utils/util',")
	// 					done()
	// 			it 'should build a child js file that is different than the same file built without a parent target', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					fs.readFileSync(path.resolve('output/section.js'), 'utf8').should.not.eql(fs.readFileSync(path.resolve('output/section/someSection.js'), 'utf8'))
	// 					done()
	// 	describe 'js project', ->
	// 		before ->
	// 			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project-js'))
	// 		describe 'with a single js file requiring 1 dependency', ->
	// 			it 'should build 1 js file', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					fs.existsSync(@builder.targets.js[0].output).should.be.true
	// 					done()
	// 			it 'should contain 2 modules', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					contents = fs.readFileSync(@builder.targets.js[0].output, 'utf8')
	// 					contents.should.include("require.register('main'")
	// 					contents.should.include("require.register('package/classcamelcase'")
	// 					done()
	// 		describe 'with a single js file requiring 1 wrapped dependency', ->
	// 			it 'should build 1 js file', (done) ->
	// 				@builder.build 'buddy_wrapped.js', false, false, false, false, false, (err) =>
	// 					fs.existsSync(@builder.targets.js[0].output).should.be.true
	// 					done()
	// 			it 'should contain 2 modules', (done) ->
	// 				@builder.build 'buddy_wrapped.js', false, false, false, false, false, (err) =>
	// 					contents = fs.readFileSync(@builder.targets.js[0].output, 'utf8')
	// 					contents.should.include("require.register('mainwrapped'")
	// 					contents.should.include("require.register('package/prewrapped'")
	// 					done()
	// 		describe 'with a directory of empty js files', ->
	// 			it 'should build 2 js files', (done) ->
	// 				@builder.build 'buddy_empty.js', false, false, false, false, false, (err) =>
	// 					gatherFiles(@builder.targets.js[0].output).should.have.length(2)
	// 					done()
	// 	describe 'css project', ->
	// 		before ->
	// 			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project-css'))
	// 		describe 'with 2 stylus files referencing a shared dependency', ->
	// 			it 'should build 2 css files', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					fs.existsSync(path.resolve(@builder.targets.css[0].output, 'one.css')).should.be.true
	// 					fs.existsSync(path.resolve(@builder.targets.css[0].output, 'two.css')).should.be.true
	// 					fs.existsSync(path.resolve(@builder.targets.css[0].output, 'three.css')).should.be.false
	// 					done()
	// 			it 'should import the dependency into both files', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					contents1 = fs.readFileSync(path.resolve(@builder.targets.css[0].output, 'one.css'), 'utf8')
	// 					contents2 = fs.readFileSync(path.resolve(@builder.targets.css[0].output, 'two.css'), 'utf8')
	// 					contents1.should.eql(contents2)
	// 					contents1.should.include("colour: '#ffffff';")
	// 					contents2.should.include("colour: '#ffffff';")
	// 					done()
	// 	describe 'html project', ->
	// 		before ->
	// 			process.chdir(path.resolve(__dirname, 'fixtures/builder/build/project-html'))
	// 		describe 'with 1 jade file', ->
	// 			it 'should build 1 html file', (done) ->
	// 				@builder.build 'buddy.js', false, false, false, false, false, (err) =>
	// 					fs.existsSync(path.resolve(@builder.targets.html[0].output)).should.be.true
	// 					done()
	// 		describe 'with 1 jade file with 2 includes', ->
	// 			it 'should build 1 html file', (done) ->
	// 				@builder.build 'buddy-include.js', false, false, false, false, false, (err) =>
	// 					fs.existsSync(path.resolve(@builder.targets.html[0].output)).should.be.true
	// 					done()
