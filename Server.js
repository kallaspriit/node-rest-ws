(function(context) {
	'use strict';

	var glob = require('glob'),
		path = require('path'),
		Q = require('q'),
		Deferred = Q.defer,
		when = Q.when,
		RestService = require('./RestService'),
		WebsocketService = require('./WebsocketService'),
		logviking = require('logviking'),
		logger = logviking.logger,
		log = logger.get('Server');

	function Server(config) {
		this._config = config;
		this._restService = new RestService();
		this._websocketService = new WebsocketService();

		this._setupLogger();

		this._restService.init(this._config.rest, this._config.websocket);
		this._websocketService.init(this._config.websocket);
	}

	Server.prototype.getRestService = function() {
		return this._restService;
	};

	Server.prototype.getWebsocketService = function() {
		return this._websocketService;
	};

	Server.prototype.start = function() {
		var deferred = new Deferred();

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

		this._restService.addApi(name, instance);
		this._websocketService.addApi(name, instance);
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

	Server.prototype._setupLogger = function() {
		logger.addReporters(
			new logviking.ConsoleLog(),
			new logviking.SocketLog(this._config.logviking.host, this._config.logviking.port)
		);
	};

	context.exports = Server;
})(module);