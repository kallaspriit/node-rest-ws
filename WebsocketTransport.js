var WebsocketTransport = function(host, port) {
	this._host = host;
	this._port = port;
	this._ws = null;
	this._requestIdCounter = 0;
	this._requestQueue = [];
	this._requestDeferreds = {};

	this._init();
};

WebsocketTransport.prototype.request = function(namespace, service, method, route, parameters, deferred) {
	var deferred = deferred || new $.Deferred(),
		id = this._requestIdCounter++,
		request = {
			namespace: namespace,
			service: service,
			method: method,
			route: route,
			parameters: parameters,
			deferred: deferred
		},
		payload = JSON.stringify({
			id: id,
			method: namespace + '.' + service,
			params: parameters
		});

	this._requestDeferreds[id] = deferred;

	if (this._ws.readyState === WebSocket.OPEN) {
		//console.log('request', id, request);

		this._ws.send(payload);
	} else if (this._ws.readyState === WebSocket.CONNECTING) {
		//console.log('queue', request);

		this._requestQueue.push(request);
	} else {
		throw new Error('WebSocket connection is not open (current state: ' + this.getState() + ')');
	}

	return deferred.promise();
};

WebsocketTransport.prototype._init = function() {
	this._ws = new WebSocket('ws://' + this._host + ':' + this._port);

	this._ws.onopen = this._onOpen.bind(this);

	// TODO error handling
	//this._ws.onerror = this._onError.bind(this);
	//this._ws.onclose = this._onClose.bind(this);
};

WebsocketTransport.prototype._onOpen = function() {
	var queuedRequest;

	//console.log('opened');

	while (this._requestQueue.length > 0) {
		queuedRequest = this._requestQueue.shift();

		this.request(
			queuedRequest.namespace,
			queuedRequest.service,
			queuedRequest.method,
			queuedRequest.route,
			queuedRequest.parameters,
			queuedRequest.deferred
		);
	}

	this._ws.onmessage = this._onMessage.bind(this);
};

WebsocketTransport.prototype._onMessage = function(message) {
	var payload,
		requestDeferred;

	try {
		payload = JSON.parse(message.data);
	} catch (e) {
		// TODO error handling
		return;
	}

	if (typeof payload.id !== 'number') {
		// TODO error handling
		return;
	}

	if (typeof this._requestDeferreds[payload.id] === 'undefined') {
		// TODO error handling
		return;
	}

	requestDeferred = this._requestDeferreds[payload.id];

	//console.log('payload', payload);

	if (typeof payload.result !== 'undefined') {
		requestDeferred.resolve(payload.result);
	} else if (typeof payload.code !== 'undefined') {
		requestDeferred.reject(payload.code + ' - ' + payload.message);
	} else {
		// TODO error handling
	}
};

WebsocketTransport.prototype.getState = function() {
	switch (this._ws.readyState) {
		case WebSocket.CONNECTING:
			return 'CONNECTING';

		case WebSocket.OPEN:
			return 'OPEN';

		case WebSocket.CLOSING:
			return 'CLOSING';

		case WebSocket.CLOSED:
			return 'CLOSED';
	}
};