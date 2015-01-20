(function(context) {
	'use strict';

	var AbstractService = require('./AbstractService'),
		Q = require('q'),
		when = Q.when,
		Deferred = Q.defer,
		WebSocket = require('ws'),
		WebSocketServer = WebSocket.Server,
		extend = require('xtend'),
		util = require('./Util'),
		log = require('logviking').logger.get('WebsocketService');

	function WebsocketService() {
		AbstractService.call(this);

		this._sessionManager = null;
		this._server = null;
		this._config = {
			bindHost: '0.0.0.0',
			publicHost: 'localhost',
			port: 8080,
			requestTimeout: 10000,
			simulateLatency: 0,
			protocolVersion: 13
		};
		this._handlers = [];
		this._namespaces = [];
		this._apis = {};
		this._clients = [];
		this._clientIdCounter = 0;
		this._requestIdCounter = 0;
	}

	WebsocketService.prototype = Object.create(AbstractService.prototype);

	WebsocketService.Error = WebsocketService.prototype.Error = {
		PARSE_ERROR: -32700,
		INVALID_REQUEST: -32600,
		METHOD_NOT_FOUND: -32601,
		INVALID_PARAMS: -32602,
		INTERNAL_ERROR: -32603
	};

	WebsocketService.SuccessResult = function(id, result) {
		this.id = id;
		this.result = result;
		this.jsonrpc = '2.0';
	};

	WebsocketService.ErrorResult = function(id, code, message, statusCode, statusName, trace) {
		this.id = id;
		this.code = code;
		this.status = statusCode;
		this.error = statusName;
		this.message = message;
		this.trace = trace;
		this.jsonrpc = '2.0';
	};

	WebsocketService.prototype.init = function(sessionManager, config) {
		this._sessionManager = sessionManager;

		this._config = extend(this._config, config || {});

		this._config.host = config.bindHost;

		log.info('initiating', this._config);

		this._server = new WebSocketServer(this._config);
		this._server.on('connection', this._onClientConnected.bind(this));
	};

	WebsocketService.prototype.start = function() {
		var deferred = new Deferred();

		deferred.resolve();

		return deferred.promise;
	};

	WebsocketService.prototype.stop = function() {

	};

	WebsocketService.prototype.getClients = function() {
		return this._clients;
	};

	WebsocketService.prototype.addHandler = function(namespace, name, method, argumentNames, handler, context) {
		log.info('add handler', namespace, name, method, argumentNames);

		this._handlers.push({
			namespace: namespace,
			name: name,
			method: method,
			argumentNames: argumentNames,
			handler: handler,
			context: context
		});
	};

	WebsocketService.prototype.createRequestPayload = function(method, params) {
		return {
			jsonrpc: '2.0',
			id: this._requestIdCounter++,
			method: method,
			params: params
		};
	};

	WebsocketService.prototype.createResponsePayload = function(id, response) {
		if (typeof response === 'undefined') {
			response = null;
		}

		response = typeof response === 'string' ? response : JSON.stringify(response);

		return {
			jsonrpc: '2.0',
			id: typeof id === 'number' ? id : null,
			result: response
		};
	};

	WebsocketService.prototype.createErrorPayload = function(id, code, message) {
		return {
			jsonrpc: '2.0',
			id: typeof id === 'number' ? id : null,
			code: code,
			message: message
		};
	};

	WebsocketService.prototype.getHandlerByMethod = function(method) {
		if (typeof method !== 'string') {
			return null;
		}

		var dotPos = method.indexOf('.'),
			namespace = null,
			name = null,
			i;

		if (dotPos !== -1) {
			namespace = method.substr(0, dotPos);
			name = method.substr(dotPos + 1);
		} else {
			name = method;
		}

		for (i = 0; i < this._handlers.length; i++) {
			if (namespace !== null && this._handlers[i].namespace !== namespace) {
				continue;
			}

			if (this._handlers[i].name === name) {
				return this._handlers[i];
			}
		}

		return null;
	};

	WebsocketService.prototype.broadcast = function(method, params) {
		var i;

		for (i = 0; i < this._clients.length; i++) {
			this._clients[i].request(method, params);
		}
	};

	WebsocketService.prototype._onClientConnected = function(client) {
		var service = this;

		client.id = this._clientIdCounter++;
		client.session = this._sessionManager.create();

		this._clients.push(client);

		log.info('#' + client.id + ' connected, there are now ' + this._clients.length + ' total');

		client.on('message', function(message, flags) {
			this._onClientMessage(client, message, flags.binary ? true : false);
		}.bind(this));

		client.on('close', function(code, message) {
			this._onClientDisconnected(client, code, message);
		}.bind(this));

		client.on('error', function(error) {
			this._onClientError(client, error);
		}.bind(this));

		client.send = function(message) {
			if (typeof(message) !== 'string') {
				throw new Error('Expected a string message');
			}

			if (this.client.readyState !== WebSocket.OPEN) {
				log.warn(
					'[' + this.client.id +'] unable to send message to client in invalid state: ' +
					this.client.readyState, message
				);

				return null;
			}

			return this.originalSend.call(this.client, message);
		}.bind({ client: client, originalSend: client.send });

		client.request = function(method, params) {
			var payload;

			try {
				payload = service.createRequestPayload(
					method,
					params
				);

				this.send(JSON.stringify(payload));
			} catch (e) {
				log.warn('failed to send request "' + method + '"', params);
			}
		};

		client.respond = function(requestId, response) {
			var responsePayload;

			try {
				responsePayload = service.createResponsePayload(
					requestId,
					response
				);

				this.send(JSON.stringify(responsePayload));
			} catch (e) {
				this.respondWithError(
					requestId,
					WebsocketService.Error.INTERNAL_ERROR,
					'Internal error: ' + e.message
				);
			}
		};

		client.respondWithError = function(requestId, code, message) {
			var responsePayload;

			try {
				responsePayload = service.createErrorPayload(
					requestId,
					code,
					message
				);

				this.send(JSON.stringify(responsePayload));
			} catch (e) {
				log.warn('sending error response failed');
			}
		};
	};

	WebsocketService.prototype._onClientDisconnected = function(client, code, message) {
		var newClients = [],
			i;

		for (i = 0; i < this._clients.length; i++) {
			if (this._clients[i] === client) {
				continue;
			}

			newClients.push(this._clients[i]);
		}

		this._clients = newClients;

		log.info(
			'#' + client.id + ' disconnected (' + code + ' - ' + (message.length > 0 ? message : 'n/a') + '), ' +
			'there are now ' + this._clients.length + ' left'
		);
	};

	WebsocketService.prototype._onClientError = function(client, error) {
		log.warn('#' + this.client.id + ' error: ' + error.message);
	};

	WebsocketService.prototype._onClientMessage = function(client, message, isBinary) {
		var resultPromises = [],
			resultPromise,
			payload,
			i;

		if (isBinary) {
			client.respondWithError(null, WebsocketService.Error.INVALID_REQUEST, 'Binary messages not supported');

			return;
		}

		message = message.trim();

		// expect either an object or an array for batch requests
		if (
			(message.substr(0, 1) === '{' && message.substr(message.length - 1, 1) === '}')
			|| (message.substr(0, 1) === '[' && message.substr(message.length - 1, 1) === ']')
		) {
			try {
				payload = JSON.parse(message);
			} catch (e) {
				client.respondWithError(
					null,
					WebsocketService.Error.PARSE_ERROR,
					'Parsing request JSON failed (' + e.message + ')'
				);

				return;
			}

			try {
				// check for batch requests
				if (Array.isArray(payload)) {
					for (i = 0; i < payload.length; i++) {
						resultPromise = this._onClientRequest(client, payload[i]);

						resultPromises.push(resultPromise);
					}
				} else {
					resultPromise = this._onClientRequest(client, payload);

					resultPromises.push(resultPromise);
				}

				Q.all(resultPromises)
					.then(function() {
						this._onRequestsCompleted(client, Array.prototype.slice.call(arguments)[0]);
					}.bind(this));
			} catch (e) {
				client.respondWithError(
					typeof payload.id === 'number' ? payload.id : null,
					WebsocketService.Error.INTERNAL_ERROR,
					'Internal error: ' + e.message
				);
			}
		} else {
			client.respondWithError(null, WebsocketService.Error.INVALID_REQUEST, 'JSON expected');
		}
	};

	WebsocketService.prototype._onClientRequest = function(client, payload) {
		var rpc = {
				jsonrpc: '2.0',
				id: null,
				params: null
			},
			timedOut = false,
			deferred = new Deferred(),
			result,
			requestTimeout;

		rpc = extend(rpc, payload);

		// method name is the only required argument
		if (typeof payload.method !== 'string' || payload.method.length === 0) {
			deferred.resolve(new WebsocketService.ErrorResult(
				rpc.id,
				WebsocketService.Error.INVALID_REQUEST,
				'Expected "method" argument to be a non-empty string'
			));
		}

		requestTimeout = setTimeout(function() {
			log.info('request time out');

			deferred.resolve(new WebsocketService.ErrorResult(
				rpc.id,
				WebsocketService.Error.INTERNAL_ERROR,
				'Request timed out after ' + this._config.requestTimeout + 'ms'
			));

			requestTimeout = null;
			timedOut = true;
		}.bind(this), this._config.requestTimeout);

		result = this._onClientRpc(client, rpc);

		when(result)
			.then(function(response) {
				var result;

				if (requestTimeout !== null) {
					clearTimeout(requestTimeout);
				}

				if (timedOut) {
					log.info('request time out, ignoring success', response);

					return;
				}

				if (typeof response === 'undefined') {
					result = new WebsocketService.ErrorResult(
						rpc.id,
						WebsocketService.Error.INTERNAL_ERROR,
						'Service returned undefined, this should not happen ' +
						'(perhaps forgot to use deferred for async request?)'
					);
				} else if (response instanceof Error) {
					result = this._buildErrorResponse(rpc.id, response);
				} else {
					if (response instanceof WebsocketService.ErrorResult) {
						result = response;
					} else {
						result = new WebsocketService.SuccessResult(rpc.id, response);
					}
				}

				deferred.resolve(result);
			}.bind(this))
			.fail(function(reason) {
				var result;

				if (requestTimeout !== null) {
					clearTimeout(requestTimeout);
				}

				if (timedOut) {
					log.info('request time out, ignoring failure', reason);

					return;
				}

				result = this._buildErrorResponse(rpc.id, reason);

				deferred.resolve(result);
			}.bind(this));

		return deferred.promise;
	};

	WebsocketService.prototype._buildErrorResponse = function(id, reason) {
		if (reason instanceof Error) {
			return new WebsocketService.ErrorResult(
				id,
				WebsocketService.Error.INTERNAL_ERROR,
				reason.message,
				reason.statusCode || 500,
				reason.statusName || 'INTERNAL_ERROR',
				util.getErrorStacktrace(reason)
			);
		} else {
			return new WebsocketService.ErrorResult(
				id,
				WebsocketService.Error.INTERNAL_ERROR,
				typeof reason === 'string' ? reason : 'request failed',
				500,
				'INTERNAL_ERROR',
				null
			);
		}
	};

	WebsocketService.prototype._onClientRpc = function(client, rpc) {
		var handlerInfo = this.getHandlerByMethod(rpc.method),
			callArguments = [],
			foundInvalidParam = false;

		log.info('#' + client.id + ' RECV: ' + JSON.stringify(rpc));

		if (handlerInfo === null) {
			return new WebsocketService.ErrorResult(
				rpc.id,
				WebsocketService.Error.METHOD_NOT_FOUND,
				'Method called "' + rpc.method + '" not found'
			);
		}

		if (typeof rpc.params !== 'object' || rpc.params === null || Array.isArray(rpc.params)) {
			return new WebsocketService.ErrorResult(
				rpc.id,
				WebsocketService.Error.INVALID_PARAMS,
				'Expected an object with keys: ' + handlerInfo.argumentNames.join(', ') +
				' but got: ' + Object.prototype.toString.call(rpc.params)
			);
		}

		handlerInfo.argumentNames.forEach(function(argumentName) {
			if (foundInvalidParam) {
				return;
			}

			if (typeof rpc.params[argumentName] === 'undefined') {
				return new WebsocketService.ErrorResult(
					rpc.id,
					WebsocketService.Error.INVALID_PARAMS,
					'Missing argument "' + argumentName + '"'
				);

				foundInvalidParam = true;
			}

			callArguments.push(rpc.params[argumentName]);
		});

		if (foundInvalidParam) {
			return result;
		}

		callArguments.push(client.session);
		callArguments.push(client);

		try {
			return handlerInfo.handler.apply(handlerInfo.context || {}, callArguments);
		} catch (e) {
			return e;
		}
	};

	WebsocketService.prototype._onRequestsCompleted = function(client, results) {
		var isBatchRequest = false,
			response,
			payload;

		if (results.length > 1) {
			response = results;
			isBatchRequest = true;
		} else {
			response = results[0];
		}

		try {
			payload = JSON.stringify(response);
		} catch (e) {
			if (isBatchRequest) {
				client.respondWithError(
					null,
					WebsocketService.Error.INTERNAL_ERROR,
					'Stringifying batch request response failed (' + e.message + ')'
				);
			} else {
				client.respondWithError(
					response.id,
					WebsocketService.Error.INTERNAL_ERROR,
					'Stringifying request response failed (' + e.message + ')'
				);
			}

			return;
		}

		log.info('simulating latency', this._config.simulateLatency);

		if (this._config.simulateLatency === 0) {
			client.send(payload);
		} else {
			setTimeout(function() {
				client.send(payload);
			}, this._config.simulateLatency);
		}
	};

	context.exports = WebsocketService;
})(module);