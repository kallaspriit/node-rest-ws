var HttpTransport = function(host, port) {
	this._host = host;
	this._port = port;
};

HttpTransport.prototype.request = function(namespace, service, method, route, parameters) {
	var url;

	switch (method) {
		case 'get':
			url = this._buildGetUrl(this._host, this._port, route, parameters);
		break;

		case 'post':
			url = this._buildPostUrl(this._host, this._port, route, parameters);
		break;

		default:
			throw new Error('Request method "' + method + '" is not supported');
	}

	var result = xhrRequest(method, url, parameters);

	// TODO keep this?
	result.dbg = function() {
		result.done(function(response) {
			console.log(response);
		});

		result.fail(function(xhr) {
			if (typeof xhr.responseJSON === 'object' && xhr.responseJSON !== null) {
				console.error(xhr.responseJSON);
			} else {
				console.error(xhr.responseText);
			}
		});

		return result;
	};

	return result;
};

HttpTransport.prototype._buildGetUrl = function(host, port, route, parameters) {
	parameters = parameters || {};

	var url = 'http://' + host + (port !== 80 ? ':' + port : '') + route,
		parameterName,
		regexp;

	for (parameterName in parameters) {
		regexp = new RegExp('\/:' + parameterName, 'g');

		url = url.replace(regexp, '/' + parameters[parameterName]);
	}

	return url;
};

HttpTransport.prototype._buildPostUrl = function(host, port, route, parameters) {
	parameters = parameters || {};

	return 'http://' + host + (port !== 80 ? ':' + port : '') + route;
};