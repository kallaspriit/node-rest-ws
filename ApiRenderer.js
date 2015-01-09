(function(context) {
	'use strict';

	var util = require('./Util'),
		fs = require('fs');

	function ApiRenderer() {
		this._restConfig = null;
		this._websocketConfig = null;
		this._apis = null;
		this._namespaces = null;
		this._handlers = null;
		this._apiDoc = null;
		this._transportType = null;
	}

	ApiRenderer.prototype.render = function(
		restConfig,
		websocketConfig,
		apis,
		namespaces,
		handlers,
		apiDoc,
		transportType
	) {
		this._restConfig = restConfig;
		this._websocketConfig = websocketConfig;
		this._apis = apis;
		this._namespaces = namespaces;
		this._handlers = handlers;
		this._apiDoc = apiDoc;
		this._transportType = transportType;

		return this._stringify([
			this._renderHeader(),
			this._pad(this._renderBody(), 1),
			this._renderFooter()
		]);
	};

	ApiRenderer.prototype._renderHeader = function() {
		return [
			'(function(context) {',
			'	\'use strict\';',
			''
		];
	};

	ApiRenderer.prototype._renderBody = function() {
		return [
			this._renderTransportClass(),
			this._renderPrivateMethods(),
			this._renderPrivateVariables(),
			this._renderClassHeader(),
			this._renderNamespaces(),
			this._renderClassFooter()
		];
	};

	ApiRenderer.prototype._renderTransportClass = function() {
		return this._readFile(util.convertEntityName(this._transportType) + 'Transport.js').split('\n').concat('');
	};

	ApiRenderer.prototype._renderClassHeader = function() {
		return [
			'var Api = function() {',
			'	// ...',
			'};',
			''
		];
	};

	ApiRenderer.prototype._renderNamespaces = function() {
		return this._namespaces.map(function(namespace) {
			var classInfo = this._apiDoc.getClassInfo(namespace);

			return [
				classInfo !== null ? this._renderNamespaceDoc(classInfo) : null,
				'Api.prototype.' + namespace + ' = {',
				this._pad(this._renderNamespaceHandlers(namespace), 1),
				'};',
				''
			];
		}.bind(this));
	};

	ApiRenderer.prototype._renderNamespaceDoc = function(classInfo) {
		return [
			'/**',
			this._renderDocDescription(classInfo.constructor.description),
			' * ',
			this._renderDocParameters(classInfo.constructor.parameters),
			' * @constructor',
			' * @alias ' + classInfo.name,
			' */',
		];
	};

	ApiRenderer.prototype._renderDocDescription = function(description) {
		var rows = description.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

		return rows.map(function(row) {
			return [' * ' + row];
		});
	};

	ApiRenderer.prototype._renderDocParameters = function(parameters, objectName) {
		var result = [objectName ? ' * @param {object} ' + objectName : null];

		return result.concat(parameters.map(function(parameter) {
			var type = parameter.type ? '{' + parameter.type + '} ' : '';

			return [
				' * @param ' + type + (objectName ? objectName + '.' : '') + parameter.name + ' ' + parameter.description
			];
		}));
	};

	ApiRenderer.prototype._renderNamespaceHandlers = function(namespace) {
		var namespaceHandlers = this._handlers.filter(function(handler) {
				return handler.namespace === namespace;
			});

		return namespaceHandlers.map(function(handler, index) {
			var methodName = util.convertCallableName(handler.method + '-' + handler.name),
				methodInfo = this._apiDoc.getMethodInfo(namespace, methodName);

			return [
				'',
				methodInfo !== null ? this._renderMethodDoc(methodInfo) : null,
				util.convertCallableName(handler.name) + ': function(parameters) {',
				'	validateParameters(parameters, ' + JSON.stringify(handler.argumentNames) + ');',
				'',
				'	return transport.request(\'' + handler.namespace + '\', \'' + handler.name + '\', \'' + handler.method + '\', \'' + handler.route + '\', parameters);',
				'}' + (index < namespaceHandlers.length - 1 ? ',' : '')
			];
		}.bind(this));
	};

	ApiRenderer.prototype._renderMethodDoc = function(methodInfo) {
		var type = methodInfo.returns && methodInfo.returns.type ? '{' + methodInfo.returns.type + '} ' : '';

		return [
			'/**',
			this._renderDocDescription(methodInfo.description),
			' * ',
			this._renderDocParameters(methodInfo.parameters, 'parameters'),
			methodInfo.returns ? ' * @returns ' + type + methodInfo.returns.description : null,
			' */',
		];
	};

	ApiRenderer.prototype._renderClassFooter = function() {
		return [
			'context.Api = Api;',
		];
	};

	ApiRenderer.prototype._renderPrivateMethods = function() {
		return [
			'var validateParameters = function(parameters, expectedParameterNames) {',
			'	expectedParameterNames.forEach(function(expectedParameterName) {',
			'		if (typeof parameters[expectedParameterName] === \'undefined\') {',
			'			throw new Error(\'Expected parameter called "\' + expectedParameterName + \'" to be present\');',
			'		}',
			'	});',
			'};',
			''
		];
	};

	ApiRenderer.prototype._renderPrivateVariables = function() {
		var config,
			host,
			port;

		switch (this._transportType) {
			case 'http':
				config = this._restConfig;
			break;

			case 'websocket':
				config = this._websocketConfig;
			break;

			default:
				throw new Error('Transport type "' + this._transportType + '" not implemented');
		}

		if (config.publicHost !== '0.0.0.0') {
			host = config.publicHost;
		} else {
			host = 'localhost';
		}

		port = config.port;

		return [
			'var transport = new ' + util.convertEntityName(this._transportType) + 'Transport(\'' + host + '\', ' + port + ');',
			''
		];
	};

	ApiRenderer.prototype._renderFooter = function() {
		return ['})(window);'];
	};

	ApiRenderer.prototype._stringify = function(rows, paddingCount) {
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

	ApiRenderer.prototype._pad = function(rows, paddingCount) {
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

	ApiRenderer.prototype._readFile = function(filename) {
		return fs.readFileSync(__dirname + '/' + filename, 'utf-8');
	};

	context.exports = ApiRenderer;
})(module);