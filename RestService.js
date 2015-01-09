(function(context) {
	'use strict';

	var restify = require('restify'),
		extend = require('xtend'),
		fs = require('fs'),
		Q = require('q'),
		Deferred = Q.defer,
		AbstractService = require('./AbstractService'),
		ReferenceRenderer = require('./ReferenceRenderer'),
		ApiRenderer = require('./ApiRenderer'),
		JsonRenderer = require('./JsonRenderer'),
		ApiDoc = require('./ApiDoc'),
		when = Q.when,
		log = require('logviking').logger.get('RestService');

	function RestService() {
		AbstractService.call(this);

		this._server = null;
		this._restConfig = {
			bindHost: '0.0.0.0',
			publicHost: 'localhost',
			port: 8080,
			requestTimeout: 10000,
			simulateLatency: 0,
			simulateErrorRatePercentage: 0
		};
		this._handlers = [];
		this._namespaces = [];
		this._apis = {};

		this._apiDoc = new ApiDoc('gen/doc.json');
		this._referenceRenderer = new ReferenceRenderer();
		this._apiRenderer = new ApiRenderer();
		this._jsonRenderer = new JsonRenderer();
	}

	RestService.prototype = Object.create(AbstractService.prototype);

	RestService.prototype.init = function(restConfig, websocketConfig) {
		this._restConfig = extend(this._restConfig, restConfig || {});
		this._websocketConfig = websocketConfig;

		log.info('initiating', this._restConfig);

		this._server = restify.createServer();
		this._server.use(restify.bodyParser());
		this._server.use(restify.CORS());
		this._server.use(restify.fullResponse());

		this._server.on('uncaughtException', function (req, res, route, err) {
			log.error('REST server error occured', err.stack);
		});
	};

	RestService.prototype.start = function() {
		var host = this._restConfig.bindHost,
			deferred = new Deferred();

		if (host === null) {
			host = '0.0.0.0';
		}

		this._augmentApis();
		this._addApiReferenceHandler();
		this._addRestApiGeneratorHandler();
		this._addWebsocketApiGeneratorHandler();
		this._addJsonGeneratorHandler();

		log.info('starting service server at ' + host + ':' + this._restConfig.port);

		this._server.listen(this._restConfig.port, host, function() {
			log.info(this._server.name + ' listening at ' + this._server.url);

			deferred.resolve();
		}.bind(this));

		return deferred.promise;
	};

	RestService.prototype.stop = function() {
		log.info('stopping rest service');

		this._server.close();
	};

	RestService.prototype.addHandler = function(namespace, name, method, argumentNames, handler, context) {
		var route = (namespace.length > 0 ? '/' + namespace : '') + '/' + name;

		if (method !== 'post') {
			if (argumentNames.length > 0) {
				route += '/:' + argumentNames.join('/:');
			}
		}

		if (namespace !== '' && this._namespaces.indexOf(namespace) === -1) {
			this._namespaces.push(namespace);
		}

		log.info('add handler for route "' + route + '"', method, argumentNames);

		this._handlers.push({
			namespace: namespace,
			name: name,
			method: method,
			argumentNames: argumentNames,
			route: route,
			handler: handler,
			context: context
		});

		this._server[method](route, function(req, res, next) {
			var callArguments = [],
				startTime = (new Date()).getTime(),
				timedOut = false,
				requestTimeout = setTimeout(function() {
					log.info('request time out');

					res.send(new restify.InternalError('request timed out after ' + this._restConfig.requestTimeout + 'ms'));

					next();

					requestTimeout = null;
					timedOut = true;
				}.bind(this), this._restConfig.requestTimeout),
				result;

			try {
				argumentNames.forEach(function(argumentName) {
					if (typeof req.params[argumentName] === 'undefined') {
						throw new restify.InvalidArgumentError('Missing argument "' + argumentName + '"');
					}

					callArguments.push(req.params[argumentName]);
				});

				callArguments = this._normalizeType(callArguments);

				log.info('handling', namespace, method, name, req.params);

				if (
					this._restConfig.simulateErrorRatePercentage > 0
					&& Math.random() * 100 < this._restConfig.simulateErrorRatePercentage
				) {
					// fake failure
					throw new Error('simulated error at ' + this._restConfig.simulateErrorRatePercentage + '% rate');
				} else {
					result = handler.apply(context || {}, callArguments.concat([req, res, next]));
				}
			} catch (e) {
				if (e instanceof restify.RestError) {
					result = e;
				} else {
					result = new restify.InternalError(e.message + ' - ' + this._getErrorLocation(e));
				}
			}

			if (result === true) {
				log.info('handler already handled the request, stopping');

				if (requestTimeout !== null) {
					clearTimeout(requestTimeout);
				}

				return;
			}

			when(result)
				.then(function(response) {
					var timeTaken = (new Date()).getTime() - startTime;

					if (requestTimeout !== null) {
						clearTimeout(requestTimeout);
					}

					if (timedOut) {
						return;
					}

					if (typeof response === 'undefined') {
						response = new restify.InternalError('Service returned undefined, this should not happen (perhaps forgot to use deferred for async request?)');
					} else if (response === null || response === false) {
						response = new restify.ResourceNotFoundError('Not found');
					}

					log.info('handled ' + req.path() + ' in ' + timeTaken + 'ms', req.params, response, typeof response);

					if (this._restConfig.simulateLatency === 0) {
						res.send(response);
						//res.write(response);
						//res.end();

						next();
					} else {
						setTimeout(function() {
							res.send(response);
							//res.write(response);
							//res.end();

							next();
						}, this._restConfig.simulateLatency);
					}
				}.bind(this))
				.fail(function(reason) {
					var errorMessage;

					if (requestTimeout !== null) {
						clearTimeout(requestTimeout);
					}

					if (reason instanceof Error) {
						res.send(new restify.InternalError(reason.message));
					} else if (reason instanceof restify.RestError) {
						res.send(reason);
					} else if (typeof reason === 'string') {
						errorMessage = typeof reason === 'string' && reason.length > 0 ? reason : 'request failed';

						res.send(new restify.InternalError(errorMessage));
					} else {
						res.send(new restify.InternalError('request failed for unknown reason'));
					}
				});
		}.bind(this));
	};

	RestService.prototype._getErrorLocation = function (e) {
		var rows = e.stack.split('\n').slice(1);

		return rows.join(' > ').replace(/    /g, '');

		/*var callerLine = e.stack.split('\n')[3],
			index = callerLine.indexOf('at ');

		return callerLine.slice(index + 3, callerLine.length);*/
	};

	RestService.prototype._addApiReferenceHandler = function() {
		this.addHandler('', '', 'get', [], function(req, res, next) {
			var html = this._getApiReferenceHtml();

			res.setHeader('Content-Type', 'text/html');
       		res.writeHead(200);
			res.end(html);

			next();

			return true;
		}, this);
	};

	RestService.prototype._addRestApiGeneratorHandler = function() {
		this.addHandler('', 'rest', 'get', [], function(req, res, next) {
			var script = this._getRestApiScript();

			res.setHeader('Content-Type', 'application/javascript');
       		res.writeHead(200);
			res.end(script);

			next();

			return true;
		}, this);
	};

	RestService.prototype._addWebsocketApiGeneratorHandler = function() {
		this.addHandler('', 'ws', 'get', [], function(req, res, next) {
			var script = this._getWebsocketApiScript();

			res.setHeader('Content-Type', 'application/javascript');
       		res.writeHead(200);
			res.end(script);

			next();

			return true;
		}, this);
	};

	RestService.prototype._addJsonGeneratorHandler = function() {
		this.addHandler('', 'json', 'get', [], function(req, res, next) {
			var json = this._getInfoJson();

			res.setHeader('Content-Type', 'application/json');
       		res.writeHead(200);
			res.end(json);

			next();

			return true;
		}, this);
	};

	RestService.prototype._getApiReferenceHtml = function() {
		var documentation = this._getDocumentation();

		return this._referenceRenderer.render(
			this._restConfig,
			this._websocketConfig,
			this._apis,
			this._namespaces,
			this._handlers,
			documentation
		);
	};

	RestService.prototype._getRestApiScript = function() {
		return this._apiRenderer.render(
			this._restConfig,
			this._websocketConfig,
			this._apis,
			this._namespaces,
			this._handlers,
			this._apiDoc,
			'http'
		);
	};

	RestService.prototype._getWebsocketApiScript = function() {
		return this._apiRenderer.render(
			this._restConfig,
			this._websocketConfig,
			this._apis,
			this._namespaces,
			this._handlers,
			this._apiDoc,
			'websocket'
		);
	};

	RestService.prototype._getInfoJson = function() {
		var documentation = this._getDocumentation();

		return this._jsonRenderer.render(
			this._restConfig,
			this._websocketConfig,
			this._apis,
			this._namespaces,
			this._handlers,
			documentation
		);
	};

	RestService.prototype._getDocumentation = function() {
		return JSON.parse(fs.readFileSync('gen/doc.json', {
			encoding: 'utf-8'
		}));
	};

	context.exports = RestService;
})(module);