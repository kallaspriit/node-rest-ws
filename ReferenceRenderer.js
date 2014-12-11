(function(context) {
	'use strict';

	var fs = require('fs');

	function IndexRenderer() {

	}

	IndexRenderer.prototype.render = function(restConfig, websocketConfig, apis, namespaces, handlers, documentation) {
		var html = '<html>' +
			'<head>' +
			'<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">' +
			'<meta name="viewport" content="width=device-width, initial-scale=1">' +
			'<title>API Reference</title>';

		html += this._getCss('gfx/bootstrap/css/bootstrap.css');
		//html += this._getCss('gfx/bootstrap/css/bootstrap-theme.min.css');
		html += this._getCss('gfx/style.css');
		html += this._getScript('gfx/jquery.js');
		html += this._getScript('gfx/bootstrap/js/bootstrap.min.js');
		html += this._getScript('gfx/scripts.js');

		html += '</head>' +
			'<body data-ws-host="' + websocketConfig.host + '" data-ws-port="' + websocketConfig.port + '">' +
			'<div class="container">';

		html += this._renderHeader(namespaces);
		html += this._renderWebsocketLog();
		html += this._renderApis(namespaces, handlers, documentation);

		html += '</div>';
		html += '</body>';
		html += '</html>';

		return html;
	};

	IndexRenderer.prototype._renderHeader = function(namespaces) {
		namespaces.sort();

		var html =
			'<nav class="navbar navbar-inverse navbar-fixed-top" role="navigation">\
				<div class="container">\
					<div class="navbar-header">\
						<button type="button" class="navbar-toggle collapsed" data-toggle="collapse" data-target="#navbar" aria-expanded="false" aria-controls="navbar">\
							<span class="sr-only">Toggle navigation</span>\
							<span class="icon-bar"></span>\
							<span class="icon-bar"></span>\
							<span class="icon-bar"></span>\
						</button>\
						<a class="navbar-brand" href="#">API Reference</a>\
					</div>\
					<div id="navbar" class="collapse navbar-collapse">\
						<ul class="nav navbar-nav">\
							' + namespaces.map(function(namespace, i) {
								return '<li class="api-namespace-link' + (i === 0 ? ' active' : '') + '" data-name="' + namespace + '"><a href="#' + namespace + '">' + namespace.substr(0, 1).toUpperCase() + namespace.substr(1) + '</a></li>';
							}).join('\n') + '\
						</ul>\
						<ul class="nav navbar-nav navbar-right">\
							<li class="dropdown">\
							  <a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false"><span id="request-mode">REST</span> <span class="caret"></span></a>\
							  <ul class="dropdown-menu" role="menu">\
								<li><a href="#" class="change-request-mode-btn" data-id="rest" data-name="REST">REST</a></li>\
								<li><a href="#" class="change-request-mode-btn" data-id="websocket" data-name="WebSockets JSON-RPC">WebSockets JSON-RPC</a></li>\
							  </ul>\
							</li>\
						  </ul>\
					</div>\
				</div>\
			</nav>';

		return html;
	};

	IndexRenderer.prototype._renderWebsocketLog = function() {
		return '<div id="websocket-log-wrap" class="row hidden">' +
			'<div class="col col-lg-12">' +
			'<div id="websocket-log" class="websocket-log"></div>' +
			'</div>' +
			'</div>';
	};

	IndexRenderer.prototype._renderApis = function(namespaces, handlers, documentation) {
		var html = '';

		namespaces.forEach(function(namespace) {
			var namespaceDocs = this._extractNamespaceDocs(documentation, namespace);

			html += '<div class="api-namespace-wrap" data-name="' + namespace + '">';

			html += this._renderNamespaceHeader(namespace, handlers, namespaceDocs);

			handlers.forEach(function(handler) {
				var handlerDocs = null;

				if (handler.namespace !== namespace) {
					return;
				}

				if (namespaceDocs !== null) {
					handlerDocs = this._extractHandlerDocs(namespaceDocs, namespace, handler);
				}

				html += this._renderHandler(handler, handlerDocs);
			}.bind(this));

			html += '</div>';
		}.bind(this));

		return html;
	};

	IndexRenderer.prototype._renderNamespaceHeader = function(namespace, handlers, namespaceDocs) {
		var html = '<div class="row">' +
			'<div class="col-lg-12">' +
			'<h2>' + namespace.substr(0, 1).toUpperCase() + namespace.substr(1) + ' api</h2>';

		if (namespaceDocs !== null) {
			html += '<div class="api-description"><strong>' + namespaceDocs.constructor.description + '</strong></div>';
		}

		html += '<ul class="handler-list">';

		handlers.forEach(function(handler, i) {
			if (handler.namespace !== namespace) {
				return;
			}

			html += '<li><a href="#' + namespace + '/' + handler.method + '-' + handler.name + '">' + (i > 0 ? '• ' : '') + handler.name + '</a></li>';
		}.bind(this));

		html += '</ul>' +
			'</div>' +
			'</div>';

		return html;
	};

	IndexRenderer.prototype._renderHandler = function(handler, handlerDocs) {
		var url;

		if (handler.method === 'get') {
			url = handler.route; // TODO replace parameters
		} else {
			url = handler.route;
		}

		var ref = 'test-' + handler.method + '-' + handler.namespace + '-' + handler.name,
			handlerTitle = '<div class="conditional show-rest"><span class="handler-method">' + handler.method + '</span> <span class="handler-route">' + handler.route + '</span></div>' +
							'<div class="conditional show-websocket">' + handler.namespace + '.' + handler.name + '</div>',
			html =
				'<div class="row handler-row">' +
				'<div class="col-lg-12">' +
				'<a class="namespace-anchor" name="' + handler.namespace + '/' + handler.method + '-' + handler.name + '"></a>';

		if (handlerDocs !== null && handlerDocs.returns.description.length > 0) {
			handlerTitle += '<span class="handler-returns"> → <span class="parameter-type parameter-type-' + handlerDocs.returns.type + '">' + handlerDocs.returns.type + '</span> ' + handlerDocs.returns.description + '</span>';
		}

		html += '<h3>' + handlerTitle + '</h3>';

		if (handlerDocs !== null) {
			html += '<div class="handler-description">' + handlerDocs.description.replace(new RegExp('\r', 'g'), '\n') + '</div>';
		}

		html += '<form class="api-form api-form-' + handler.method + ' form-horizontal" method="' + handler.method + '" target="' + ref + '" action="' + url + '" data-namespace="' + handler.namespace + '" data-name="' + handler.name + '" data-action="' + url + '">';

		handler.argumentNames.forEach(function(argumentName) {
			var ref = handler.method + '-' + handler.name + '-' + argumentName,
				label = argumentName,
				description = argumentName,
				parameterInfo = null;

			if (handlerDocs !== null) {
				parameterInfo = this._extractParameterInfo(handlerDocs, argumentName);
			}

			if (parameterInfo !== null) {
				label = '<span class="parameter-type parameter-type-' + parameterInfo.type + '">' + parameterInfo.type + '</span> ' + argumentName;
				description = parameterInfo.description;
			}

			html +=
				'<div class="form-group">\
					<label for="' + ref + '" class="col-sm-2 control-label">' + label + '</label>\
					<div class="col-sm-10">\
					  <input type="text" name="' + argumentName + '" class="form-control" id="' + ref + '" placeholder="' + description + '">\
					</div>\
				  </div>';
		}.bind(this));

		html +=
			'<div class="form-group">\
				<div class="col-sm-10 col-sm-push-2">\
					<button class="btn btn-default execute-btn" type="submit" data-name="' + ref + '">Execute</button> \
				</div>\
			  </div>';

		html +=
			'</form>' +
			//'<iframe name="test-' + handler.method + '-' + handler.namespace + '-' + handler.name + '"></iframe>' +
			'<div class="response-title" data-name="' + ref + '">xxx</div>' +
			'<div class="response-wrap" data-name="' + ref + '"></div>' +
			'</div>' +
			'</div>';

		return html;
	};

	IndexRenderer.prototype._extractNamespaceDocs = function(documentation, namespace) {
		var namespaceDocs = null;

		documentation.classes.forEach(function(docClass) {
			if (docClass.name === namespace) {
				namespaceDocs = docClass;
			}
		});

		return namespaceDocs;
	};

	IndexRenderer.prototype._extractHandlerDocs = function(namespaceDocs, namespace, handler) {
		var handlerDocs = null,
			fnName = this._convertCallableName(
					handler.method + '-' + handler.name
				);

		namespaceDocs.functions.forEach(function(fnDc) {
			if (fnDc.name === fnName) {
				handlerDocs = fnDc;
			}
		});

		return handlerDocs;
	};

	IndexRenderer.prototype._extractParameterInfo = function(handlerDocs, parameterName) {
		var parameterInfo = null;

		handlerDocs.parameters.forEach(function(param) {
			if (param.name === parameterName) {
				parameterInfo = param;
			}
		});

		return parameterInfo;
	};

	IndexRenderer.prototype._getScript = function(filename) {
		var contents = fs.readFileSync(__dirname + '/' + filename, 'utf-8'),
			result = '<script>\n' +
				contents + '\n' +
				'</script>\n';

		return result;
	};

	IndexRenderer.prototype._getCss = function(filename) {
		var contents = fs.readFileSync(__dirname + '/' + filename, 'utf-8'),
			result = '<style>\n' +
				contents + '\n' +
				'</style>\n';

		return result;
	};

	IndexRenderer.prototype._convertCallableName = function(name) {
		var dashPos;

		while ((dashPos = name.indexOf('-')) != -1) {
			name = name.substr(0, dashPos) + (name.substr(dashPos + 1, 1)).toUpperCase() + name.substr(dashPos + 2);
		}

		return name;
	};

	IndexRenderer.prototype._convertEntityName = function(name) {
		var dashPos;

		while ((dashPos = name.indexOf('-')) != -1) {
			name = name.substr(0, dashPos) + (name.substr(dashPos + 1, 1)).toUpperCase() + name.substr(dashPos + 2);
		}

		return name.substr(0, 1).toUpperCase() + name.substr(1);
	};

	context.exports = IndexRenderer;
})(module);