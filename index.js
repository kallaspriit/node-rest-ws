(function(context) {
	'use strict';

	context.exports = {
		Server: require('./Server'),
		AbstractService: require('./AbstractService'),
		RestService: require('./RestService'),
		WebsocketService: require('./WebsocketService'),
		ReferenceRenderer: require('./ReferenceRenderer'),
		SessionManager: require('./SessionManager'),
		Errors: require('./Errors'),
		expect: require('./Expect')
	};
})(module);