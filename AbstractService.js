(function(context) {
	'use strict';

	function AbstractService() {}

	AbstractService.prototype.init = function(config) {
		void(config);
	};

	AbstractService.prototype.addApi = function(namespace, api) {
		var reservedArgumentsNames = ['sess', 'session', 'req', 'res', 'next'],
			ignoredMethods = api.ignoredApiMethods || [],
			argumentNames,
			filteredArgumentNames,
			functionName,
			handlerSignature;

		this._apis[namespace] = api;

		for (functionName in api) {
			if (
				typeof api[functionName] !== 'function'
				|| functionName.substr(0, 1) === '_'
				|| ignoredMethods.indexOf(functionName) !== -1
			) {
				continue;
			}

			argumentNames = this._getFunctionArgumentNames(api[functionName]);
			filteredArgumentNames = [];

			argumentNames.forEach(function(argumentName) {
				if (argumentName.substr(0, 1) === '_' || reservedArgumentsNames.indexOf(argumentName) !== -1) {
					return;
				}

				filteredArgumentNames.push(argumentName);
			});

			try {
				handlerSignature = this._getHandlerSignature(functionName);

				this.addHandler(
					namespace,
					handlerSignature.name,
					handlerSignature.method,
					filteredArgumentNames,
					api[functionName],
					api
				);
			} catch (e) {}
		}
	};

	AbstractService.prototype.start = function(startedCallback) {
		void(startedCallback);

		throw new Error('Not implemented');
	};

	AbstractService.prototype.stop = function() {};

	AbstractService.prototype._getFunctionArgumentNames = function(fn) {
		if (typeof fn !== 'function') {
			throw new Error('Expected a function');
		}

		var stripCommentsRegexp = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg,
			argumentNamesRegexp = /([^\s,]+)/g,
			functionName = fn.toString().replace(stripCommentsRegexp, ''),
			argumentNames = functionName
				.slice(functionName.indexOf('(') + 1, functionName.indexOf(')'))
				.match(argumentNamesRegexp);

		if (argumentNames === null) {
			return [];
		}

		return argumentNames;
	};

	AbstractService.prototype._getHandlerSignature = function(functionName) {
		var methods = ['get', 'post'],
			method = null,
			callName = null,
			i;

		for (i = 0; i < methods.length; i++) {
			if (functionName.substr(0, methods[i].length) === methods[i]) {
				method = methods[i];
				callName = functionName.substr(methods[i].length);
			}
		}

		if (method === null) {
			throw new Error(
				'Failed to extract method from "' + functionName + '", expected one of: ' + methods.join(', ')
			);
		}

		return {
			name: this._convertCallToUrlName(callName),
			method: method
		};
	};

	AbstractService.prototype._augmentApis = function() {
		var namespace,
			innerNamespace;

		for (namespace in this._apis) {
			this._apis[namespace].api = {};

			for (innerNamespace in this._apis) {
				if (innerNamespace === namespace) {
					continue;
				}

				this._apis[namespace].api[innerNamespace] = this._apis[innerNamespace];
			}
		}
	};

	AbstractService.prototype._convertCallToUrlName = function(name) {
		var urlName = '',
			sourceChar,
			lowerChar,
			i;

		for (i = 0; i < name.length; i++) {
			sourceChar = name[i];
			lowerChar = name[i].toLowerCase();

			if (lowerChar === sourceChar) {
				urlName += sourceChar;
			} else {
				if (i > 0) {
					urlName += '-';
				}

				urlName += lowerChar;
			}
		}

		return urlName;
	};

	/**
	 * Normalizes object value types from generic string to int/float/boolean if possible.
	 *
	 * @param {*} param Variable to normalize
	 * @returns {*}
	 * @memberof util
	 */
	AbstractService.prototype._normalizeType = function(param) {
		var key,
			i;

		if (typeof param === 'string') {
			if (parseInt(param, 10) == param) {
				return parseInt(param, 10);
			} else if (parseFloat(param) == param) {
				return parseFloat(param);
			} else if (param.toLowerCase(param) === 'true') {
				return true;
			} else if (param.toLowerCase(param) === 'false') {
				return false;
			} else if (param.toLowerCase(param) === 'null') {
				return null;
			} else {
				return param;
			}
		} else if (param instanceof Array) {
			for (i = 0; i < param.length; i++) {
				param[i] = this._normalizeType(param[i]);
			}

			return param;
		} else if (typeof param === 'object' && param !== null) {
			for (key in param) {
				/* istanbul ignore if */
				if (!param.hasOwnProperty(key)) {
					continue;
				}

				param[key] = this._normalizeType(param[key]);
			}

			return param;
		} else {
			return param;
		}
	};

	context.exports = AbstractService;
})(module);