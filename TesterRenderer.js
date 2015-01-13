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

		return this._stringify([
			this._renderHeader(),
			this._renderDependencies(),
			this._renderApi(),
			this._renderSpecs(),
			this._renderFooter()
		]);
	};

	TesterRenderer.prototype._renderHeader = function() {
		return [
			'<!DOCTYPE html>',
			'<html>',
			'<head>',
			'<meta charset="utf-8">',
			'<title>Server tests</title>',
		];
	};

	TesterRenderer.prototype._renderDependencies = function() {
		return [
			this._getCss('gfx/jasmine/jasmine.css'),
			this._getScript('gfx/jquery.js'),
			this._getScript('gfx/jasmine/jasmine.js'),
			this._getScript('gfx/jasmine/jasmine-html.js'),
			this._getScript('gfx/jasmine/boot.js'),
		];
	};

	TesterRenderer.prototype._renderApi = function() {
		var host = this._restConfig.publicHost,
			port = this._restConfig.port;

		if (host === '0.0.0.0') {
			host = 'localhost';
		}

		return [
			'<script src="http://' + host + (port !== 80 ? ':' + port : '') + '/rest"></script>',
			'<script>',
			'window.api = new Api();',
			'</script>',
		];
	};

	TesterRenderer.prototype._renderSpecs = function() {
		return [
			this._specs.map(function(spec) {
				return this._getScript('../../' + spec);
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