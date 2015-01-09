(function(context) {
	'use strict';

	var restify = require('restify'),
		extend = require('xtend'),
		fs = require('fs'),
		Q = require('q'),
		Deferred = Q.defer,
		CookieParser = require('restify-cookies'),
		AbstractService = require('./AbstractService'),
		ReferenceRenderer = require('./ReferenceRenderer'),
		ApiRenderer = require('./ApiRenderer'),
		JsonRenderer = require('./JsonRenderer'),
		ApiDoc = require('./ApiDoc'),
		Errors = require('./Errors'),
		when = Q.when,
		log = require('logviking').logger.get('RestService');

	function RestService() {
		AbstractService.call(this);

		this._server = null;
		this._sessionManager = null;
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

	RestService.prototype.init = function(sessionManager, restConfig, websocketConfig) {
		this._sessionManager = sessionManager;
		this._restConfig = extend(this._restConfig, restConfig || {});
		this._websocketConfig = websocketConfig;

		log.info('initiating', this._restConfig);

		this._server = restify.createServer();
		this._server.use(restify.bodyParser());
		this._server.use(restify.CORS());
		this._server.use(restify.fullResponse());
		this._server.use(CookieParser.parse);

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
			return this._onHandlerCalled(namespace, name, method, argumentNames, handler, context, req, res, next);
		}.bind(this));
	};

	RestService.prototype._onHandlerCalled = function(
		namespace,
		handlerName,
		method,
		argumentNames,
		handler,
		context,
		req,
		res,
		next
	) {
		var callArguments = [],
			timedOut = false,
			requestTimeout = this._createRequestTimeout(function() {
				log.warn('request timed out');

				res.send(new restify.InternalError('request timed out after ' + this._restConfig.requestTimeout + 'ms'));

				next();

				requestTimeout = null;
				timedOut = true;
			}.bind(this)),
			sessionId = typeof req.cookies.sessionId === 'string' ? req.cookies.sessionId : null,
			session = null,
			result;

		if (sessionId !== null) {
			session = this._sessionManager.get(sessionId);
		}

		if (session === null) {
			session = this._sessionManager.create();
			sessionId = session.id;

			res.setCookie('sessionId', sessionId);
		}

		try {
			argumentNames.forEach(function(argumentName) {
				if (typeof req.params[argumentName] === 'undefined') {
					throw new restify.InvalidArgumentError('Missing argument "' + argumentName + '"');
				}

				callArguments.push(req.params[argumentName]);
			});

			callArguments = this._normalizeType(callArguments);

			if (this._isSimulatedFailure()) {
				throw new Error('simulated error at ' + this._restConfig.simulateErrorRatePercentage + '% rate');
			}

			result = handler.apply(context || {}, callArguments.concat([session, req, res, next]));
		} catch (e) {
			result = e;
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
				if (requestTimeout !== null) {
					clearTimeout(requestTimeout);
				}

				if (timedOut) {
					return;
				}

				this._respond(response, res, next);
			}.bind(this))
			.fail(function(reason) {
				if (requestTimeout !== null) {
					clearTimeout(requestTimeout);
				}

				if (reason === null || typeof reason === 'undefined') {
					reason = new Error('Unknown error occured');
				}

				if (!(reason instanceof Error)) {
					reason = new Errors.InternalError(reason);
				}

				log.warn('request failed', reason);

				this._respond(reason, res, next);
			}.bind(this));
	};

	RestService.prototype._respond = function(response, res, next) {
		var statusCode = 200,
			payload = response;

		log.info('respond', response, typeof response);

		if (typeof response === 'undefined' || response === null) {
			response = new Errors.NotFound('Not found');
		}

		if (response instanceof Error) {
			statusCode = response.statusCode || 500;
			payload = {
				error: response.statusName || 'INTERNAL_ERROR',
				message: response.message,
				trace: this._getErrorLocation(response)
			};
		}

		if (this._restConfig.simulateLatency === 0) {
			res.send(statusCode, payload);

			next();
		} else {
			setTimeout(function() {
				res.send(statusCode, payload);

				next();
			}, this._restConfig.simulateLatency);
		}
	};

	RestService.prototype._createRequestTimeout = function(requestTimedOutCallback) {
		return setTimeout(requestTimedOutCallback, this._restConfig.requestTimeout);
	};

	RestService.prototype._isSimulatedFailure = function() {
		return this._restConfig.simulateErrorRatePercentage > 0
			&& Math.random() * 100 < this._restConfig.simulateErrorRatePercentage;
	};

	RestService.prototype._getErrorLocation = function (e) {
		if (typeof e.stack !== 'string') {
			return 'unknown location';
		}

		//return e.stack;

		var rows = e.stack.split('\n');

		return rows.join(' > ').replace(/    /g, '');

		/*var callerLine = e.stack.split('\n')[3],
			index = callerLine.indexOf('at ');

		return callerLine.slice(index + 3, callerLine.length);*/
	};

	RestService.prototype._addApiReferenceHandler = function() {
		this.addHandler('', '', 'get', [], function(session, req, res, next) {
			var html = this._getApiReferenceHtml();

			res.setHeader('Content-Type', 'text/html');
       		res.writeHead(200);
			res.end(html);

			next();

			return true;
		}, this);
	};

	RestService.prototype._addRestApiGeneratorHandler = function() {
		this.addHandler('', 'rest', 'get', [], function(session, req, res, next) {
			var script = this._getRestApiScript();

			res.setHeader('Content-Type', 'application/javascript');
       		res.writeHead(200);
			res.end(script);

			next();

			return true;
		}, this);
	};

	RestService.prototype._addWebsocketApiGeneratorHandler = function() {
		this.addHandler('', 'ws', 'get', [], function(session, req, res, next) {
			var script = this._getWebsocketApiScript();

			res.setHeader('Content-Type', 'application/javascript');
       		res.writeHead(200);
			res.end(script);

			next();

			return true;
		}, this);
	};

	RestService.prototype._addJsonGeneratorHandler = function() {
		this.addHandler('', 'json', 'get', [], function(session, req, res, next) {
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