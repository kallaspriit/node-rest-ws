(function(context) {
	'use strict';

	function JsonRenderer() {}

	JsonRenderer.prototype.render = function(restConfig, websocketConfig, apis, namespaces, handlers, documentation) {
		handlers.forEach(function(handler) {
			delete handler.context;
		});

		return JSON.stringify({
			restConfig: restConfig,
			websocketConfig: websocketConfig,
			//apis: apis,
			namespaces: namespaces,
			handlers: handlers,
			documentation: documentation
		}, null, '\t');
	};

	context.exports = JsonRenderer;
})(module);