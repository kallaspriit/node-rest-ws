(function(context) {
	'use strict';

	var fs = require('fs');

	function Renderer() {
		this._restConfig = null;
		this._websocketConfig = null;
		this._apis = null;
		this._namespaces = null;
		this._handlers = null;
		this._apiDoc = null;
		this._transportType = null;
	}

	Renderer.prototype._stringify = function(rows, paddingCount) {
		paddingCount = paddingCount || 0;

		if (!(rows instanceof Array)) {
			throw new Error('Expected an array for _stringify but got a ' + (typeof rows));
		}

		var output = '',
			padding = new Array(paddingCount + 1).join('\t');

		rows.forEach(function(row, index) {
			if (row === null) {
				return;
			}

			if (row instanceof Array) {
				row = this._stringify(row, paddingCount);
			}

			output += padding + row;

			if (index < rows.length - 1) {
				output += '\n';
			}
		}.bind(this));

		return output;
	};

	Renderer.prototype._pad = function(rows, paddingCount) {
		var padding = new Array(paddingCount + 1).join('\t');

		rows.forEach(function(row, index) {
			if (row === null) {
				return;
			}

			if (row instanceof Array) {
				rows[index] = this._pad(row, paddingCount);
			} else {
				rows[index] = padding + row;
			}
		}.bind(this));

		return rows;
	};

	Renderer.prototype._readFile = function(filename) {
		return fs.readFileSync(__dirname + '/' + filename, 'utf-8');
	};

	Renderer.prototype._getScript = function(filename) {
		var contents = fs.readFileSync(__dirname + '/' + filename, 'utf-8'),
			result = '<script>\n' +
				contents + '\n' +
				'</script>\n';

		return result;
	};

	Renderer.prototype._getCss = function(filename) {
		var contents = fs.readFileSync(__dirname + '/' + filename, 'utf-8'),
			result = '<style>\n' +
				contents + '\n' +
				'</style>\n';

		return result;
	};

	Renderer.prototype._convertEntityName = function(name) {
		var dashPos;

		while ((dashPos = name.indexOf('-')) != -1) {
			name = name.substr(0, dashPos) + (name.substr(dashPos + 1, 1)).toUpperCase() + name.substr(dashPos + 2);
		}

		return name.substr(0, 1).toUpperCase() + name.substr(1);
	};

	context.exports = Renderer;
})(module);