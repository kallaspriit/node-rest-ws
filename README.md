node-rest-ws
============

Library for creating powerful self-documenting and testable REST + WebSocket API's.

Example
-------
```javascript
(function() {
	'use strict';

	var Server = require('rest-ws').Server,
		config = require('./config/config'),
		server = new Server(config),
		apis = server.findApisInDirectory('api', '*-api.js'),
		i;
	
	for (i = 0; i < apis.length; i++) {
		server.addApi(apis[i].name, new apis[i].constructor());
	}

	server.start();
})();
```

Test API
--------
```javascript
(function(context) {
	'use strict';

	var Deferred = require('q').defer;

	function TestApi() {

	}

	// following are API test requests
	// TODO create an actual automatic test suite based on these

	// 200 test-sync/1/2/3 > {"a":2,"b":4,"c":6}
	// 404 test-sync/1/2/3/4 > {"code":"ResourceNotFound","message":"/test-sync/1/2/3/4 does not exist"}
	TestApi.prototype.getSync = function (a, b, c) {
		return {
			a: a * 10,
			b: b * 10,
			c: c * 10,
		};
	};

	TestApi.prototype.postSync = function (a, b, c) {
		return {
			a: a * 2,
			b: b * 2,
			c: c * 2,
		};
	};

	// 200 test-async/1/2/3 > {"a":2,"b":4,"c":6}
	// 404 test-async/1/2/3/4 > {"code":"ResourceNotFound","message":"/test-sync/1/2/3/4 does not exist"}
	TestApi.prototype.getAsync = function (a, b, c) {
		var deferred = new Deferred();

		setTimeout(function () {
			deferred.resolve({
				a: a * 2,
				b: b * 2,
				c: c * 2,
			});
		}, 1000);

		return deferred.promise;
	};

	// 500 test-async-fail-message > {"code":"InternalError","message":"request failed (meh)"}
	TestApi.prototype.getAsyncFailMessage = function () {
		var deferred = new Deferred();

		setTimeout(function () {
			deferred.reject('reject error message');
		}, 1000);

		return deferred.promise;
	};

	// 500 test-async-fail-error > {"code":"InvalidArgument","message":"missing \"foobar\" argument"}
	TestApi.prototype.getAsyncFailError = function () {
		var deferred = new Deferred();

		setTimeout(function () {
			deferred.reject(new Error('missing "foobar" argument'));
		}, 1000);

		return deferred.promise;
	};

	// 500 test-async-fail-undefined > {"code":"InternalError","message":"request failed for unknown reason"}
	TestApi.prototype.getAsyncFailUndefined = function () {
		var deferred = new Deferred();

		setTimeout(function () {
			deferred.reject();
		}, 1000);

		return deferred.promise;
	};

	// 500 test-sync-undefined > {"code":"InternalError","message":"service returned undefined, this should not happen (perhaps forgot to use deferred for async request?)"}
	TestApi.prototype.getSyncUndefined = function () {
		// don't return anything
	};

	// 500 test-async-undefined > {"code":"InternalError","message":"service returned undefined, this should not happen (perhaps forgot to use deferred for async request?)"}
	TestApi.prototype.getAsyncUndefined = function () {
		var deferred = new Deferred();

		setTimeout(function () {
			deferred.resolve();
		}, 1000);

		return deferred.promise;
	};

	// 500 test-async-unresolved >
	TestApi.prototype.getAsyncUnresolved = function () {
		var deferred = new Deferred();

		// never resolved

		return deferred.promise;
	};

	// 404 test-null > {"code":"ResourceNotFound","message":"Not found"}
	TestApi.prototype.getNull = function () {
		return null;
	};

	// 404 test-false > {"code":"ResourceNotFound","message":"Not found"}
	TestApi.prototype.getFalse = function () {
		return false;
	};

	// 200 test-string > "hello world"
	TestApi.prototype.getString = function () {
		return 'hello world';
	};

	// 500 test-error > {"code":"InternalError","message":"request failed: foobar is not defined"}
	TestApi.prototype.getError = function () {
		foobar(); // jshint ignore:line
	};

	// 500 test-exception > {"code":"InternalError","message":"request faile: Something went wrong"}
	TestApi.prototype.getException = function () {
		throw new Error('Something went wrong');
	};

	// 500 test-async-undefined > {"code":"InternalError","message":"request timed out after 10000ms"}
	TestApi.prototype.getAsyncException = function () {
		var deferred = new Deferred();

		setTimeout(function () {
			throw new Error('Something went wrong');
		}, 1000);

		return deferred.promise;
	};

	context.exports = TestApi;
})(module)
```