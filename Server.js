(function(context) {
	'use strict';

	var glob = require('glob'),
		path = require('path'),
		Q = require('q'),
		Deferred = Q.defer,
		when = Q.when,
		RestService = require('./RestService'),
		WebsocketService = require('./WebsocketService'),
		SessionManager = require('./SessionManager'),
		logviking = require('logviking'),
		logger = logviking.logger,
		log = logger.get('Server');

	function Server(config) {
		this._apis = {};
		this._config = config;
		this._sessionManager = new SessionManager();
		this._restService = new RestService(this);
		this._websocketService = new WebsocketService(this);
		this._isInitialized = false;

		this._setupLogger();
	}

	Server.prototype.getSessionManager = function() {
		return this._sessionManager;
	};

	Server.prototype.setSessionManager = function(sessionManager) {
		this._sessionManager = sessionManager;
	};

	Server.prototype.getRestService = function() {
		return this._restService;
	};

	Server.prototype.getWebsocketService = function() {
		return this._websocketService;
	};

	Server.prototype.setSpecs = function(specs) {
		this._restService.setSpecs(specs);
	};

	Server.prototype.init = function() {
		if (this._isInitialized) {
			return;
		}

		this._isInitialized = true;

		this._restService.init(this._sessionManager, this._config.rest, this._config.websocket, this._config.version);
		this._websocketService.init(this._sessionManager, this._config.websocket);
	};

	Server.prototype.start = function() {
		var deferred = new Deferred();

		this._sessionManager.init();

		when(
			this._restService.start(),
			this._websocketService.start()
		).then(function() {
			deferred.resolve();
		});

		return deferred.promise;
	};

	Server.prototype.stop = function() {
		this._restService.stop();
		this._websocketService.stop();
	};

	Server.prototype.addApi = function(name, instance) {
		log.info('adding api "' + name + '"');

		if (!this._isInitialized) {
			this.init();
		}

		instance.sessionManager = this._sessionManager;

		this._apis[name] = instance;
		this._restService.addApi(name, instance);
		this._websocketService.addApi(name, instance);
	};

	Server.prototype.getApi = function(name) {
		return this._apis[name] || null;
	}

	Server.prototype.serveFile = function(filename, name, type, preprocessor) {
		this._restService.serveFile(filename, name, type, preprocessor);
	};

	Server.prototype.findApisInDirectory = function(directory, globPattern) {
		directory = directory || 'api';
		globPattern = globPattern || '*-api.js';

		var files = glob.sync(globPattern, {
				cwd: directory
			}),
			apis = [];

		files.forEach(function(filename) {
			var apiName = filename.substr(0, filename.length - 7);

			apis.push({
				name: apiName,
				filename: filename,
				constructor: require(path.resolve(directory) + '/' +filename)
			});
		});

		return apis;
	};

	Server.prototype.findSpecsInDirectory = function(directory, globPattern) {
		directory = directory || 'test';
		globPattern = globPattern || '*-spec.js';

		var files = glob.sync(globPattern, {
				cwd: directory
			}),
			specs = [];

		files.forEach(function(filename) {
			specs.push(directory + '/' + filename);
		});

		return specs;
	};

	Server.prototype.onError = function(info, session) {
		log.error(info.error + ': ' + info.message);
	};

	Server.prototype._setupLogger = function() {
		logger.addReporters(
			new logviking.ConsoleLog(),
			new logviking.SocketLog(this._config.logviking.host, this._config.logviking.port)
		);
	};

	context.exports = Server;
})(module);