(function(context) {
	'use strict';

	var Renderer = require('./Renderer');

	function TesterRenderer() {
		Renderer.call(this);

		this._restConfig = null;
		this._specs = [];
	}

	TesterRenderer.prototype = Object.create(Renderer.prototype);

	TesterRenderer.prototype.render = function(restConfig, specs) {
		this._restConfig = restConfig;
		this._specs = specs || [];

		return {
			files: this._getFiles(),
			html: this._stringify([
				this._renderHeader(),
				this._renderDependencies(),
				this._renderApi(),
				this._renderSpecs(),
				this._renderFooter()
			])
		};
	};

	TesterRenderer.prototype._getFiles = function() {
		var files = [
			{
				filename: __dirname + '/gfx/jasmine/jasmine.css',
				name: 'file/gfx/jasmine/jasmine.css',
				type: 'text/css'
			}, {
				filename: __dirname + '/gfx/jquery.js',
				name: 'file/gfx/jquery.js',
				type: 'application/javascript'
			}, {
				filename: __dirname + '/gfx/jasmine/jasmine.js',
				name: 'file/gfx/jasmine/jasmine.js',
				type: 'application/javascript'
			}, {
				filename: __dirname + '/gfx/jasmine/jasmine-html.js',
				name: 'file/gfx/jasmine/jasmine-html.js',
				type: 'application/javascript'
			}, {
				filename: __dirname + '/gfx/jasmine/boot.js',
				name: 'file/gfx/jasmine/boot.js',
				type: 'application/javascript'
			}
		];

		this._specs.forEach(function(spec) {
			files.push({
				filename: spec,
				name: 'file/' + spec,
				type: 'application/javascript'
			});
		});

		return files;
	};

	TesterRenderer.prototype._renderHeader = function() {
		return [
			'<!DOCTYPE html>',
			'<html>',
			'<head>',
			'<meta charset="utf-8">',
			'<title>API Tests</title>',
		];
	};

	TesterRenderer.prototype._renderDependencies = function() {
		return [
			'<link rel="stylesheet" type="text/css" href="/file/gfx/jasmine/jasmine.css">',
			'<script src="/file/gfx/jquery.js"></script>',
			'<script src="/file/gfx/jasmine/jasmine.js"></script>',
			'<script src="/file/gfx/jasmine/jasmine-html.js"></script>',
			'<script src="/file/gfx/jasmine/boot.js"></script>',
			'<script src="/file/gfx/jquery.js"></script>'
		];
	};

	TesterRenderer.prototype._renderApi = function() {
		var host = this._restConfig.publicHost,
			port = this._restConfig.port;

		if (host === '0.0.0.0') {
			host = 'localhost';
		}

		return [
			'<script src="http://' + host + (port !== 80 ? ':' + port : '') + '/rest/Api"></script>',
			'<script>',
			'window.api = new Api();',
			'</script>',
		];
	};

	TesterRenderer.prototype._renderSpecs = function() {
		return [
			this._specs.map(function(spec) {
				return '<script src="/file/' + spec + '"></script>';
			}.bind(this))
		];
	};

	TesterRenderer.prototype._renderFooter = function() {
		return [
			'</html>'
		];
	};

	context.exports = TesterRenderer;
})(module);