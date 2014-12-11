(function($) {
	'use strict';

	var RequestMode = {
		REST: 'rest',
		WEBSOCKET: 'websocket'
	};

	var requestMode = RequestMode.REST,
		websocketRequestCounter = 0,
		websocketResponseHandlerMap = {},
		ws = null;

	function setupApiNamespaceLinks() {
		$('.api-namespace-link').each(function() {
			$(this).click(function() {
				openNamespace($(this).data('name'));
			});
		});
	}

	function setupWebsocket() {
		var $body = $(document.body),
			host = $body.data('ws-host'),
			port = $body.data('ws-port');

		if (host === '0.0.0.0') {
			host = 'localhost';
		}

		ws = new WebSocket('ws://' + host + ':' + port);

		ws.onopen = function() {
			console.log('opened');

			ws.onmessage = function(message) {
				var payload;

				appendWebsocketLog('< ' + message.data);

				try {
					payload = JSON.parse(message.data);

					if (
						typeof payload.id === 'number'
						&& typeof websocketResponseHandlerMap[payload.id] !== 'undefined'
					) {
						websocketResponseHandlerMap[payload.id](message);
					}
				} catch (e) {}

				console.log('ws message', message.data);
			};
		};

		ws.onerror = function() {
			console.log('ws error');
		};

		ws.onclose = function() {
			console.log('ws closed');
		};
	}

	function setupForms() {
		$('.api-form').submit(function(e) {
			var $form = $(e.target),
				$inputs = $form.find('INPUT'),
				namespace = $form.data('namespace'),
				name = $form.data('name'),
				action = $form.data('action'),
				method = $form.attr('method'),
				target = $form.attr('target'),
				parameters = {};

			$inputs.each(function() {
				var $input = $(this),
					type = $input.attr('type'),
					name = $input.attr('name'),
					value = $input.val(),
					regexp;

				if (type !== 'text') {
					return;
				}

				regexp = new RegExp('\/:' + name, 'g');
				action = action.replace(regexp, '/' + value);

				parameters[name] = value;
			});

			switch (requestMode) {
				case RequestMode.REST:
					makeRestRequest(action, target, method, parameters);
				break;

				case RequestMode.WEBSOCKET:
					makeWebsocketRequest(target, namespace, name, parameters);
				break;
			}

			e.preventDefault();
		});
	}

	function setupRequestModeSwitching() {
		$('.change-request-mode-btn').click(function(e) {
			var id = $(this).data('id'),
				name = $(this).data('name');

			setRequestMode(id, name);

			e.preventDefault();
		});
	}

	function appendWebsocketLog(message) {
		var $logWrap = $('#websocket-log-wrap'),
			$logContainer = $('#websocket-log'),
			wasLogAtBottom = isAtBottom($logContainer[0]);

		$logWrap.removeClass('hidden');

		$logContainer.append('<div class="websocket-log-row">' + message + '</div>');

		if (wasLogAtBottom) {
			scrollToBottom($logContainer[0]);
		}
	}

	function makeRestRequest(action, target, method, parameters) {
		var startTime = (new Date()).getTime(),
			$executeBtn = $('.execute-btn[data-name="' + target + '"]');

		$executeBtn.attr('disabled', true).text('Working..');

		$.ajax({
			url: action,
			type: method,
			data: method === 'post' ? parameters : ''
		}).done(function(response, status, xhr) {
			var timeTaken = (new Date()).getTime() - startTime;

			showResponse(target, true, xhr.status + ' • ' + timeTaken + 'ms', response);

			console.log('response', response);
		}).fail(function(xhr, error) {
			var timeTaken = (new Date()).getTime() - startTime,
				response = error;

			if (typeof xhr.responseJSON !== 'undefined') {
				response = xhr.responseJSON;
			} else if (typeof xhr.responseText === 'string') {
				response = xhr.responseText;
			}

			showResponse(target, false, xhr.status + ' • ' + timeTaken + 'ms', response);

			console.log('fail', xhr);
		}).always(function() {
			$executeBtn.attr('disabled', false).text('Execute');
		});
	}

	function makeWebsocketRequest(target, namespace, name, parameters) {
		var id = websocketRequestCounter++,
			startTime = (new Date()).getTime(),
			$executeBtn = $('.execute-btn[data-name="' + target + '"]'),
			payload = JSON.stringify({
				id: id,
				method: namespace + '.' + name,
				params: parameters
			});

		$executeBtn.attr('disabled', true).text('Working..');

		var messageReceived = false;

		handleWebsocketResponse(id, function(message) {
			var payload = JSON.parse(message.data),
				timeTaken = (new Date()).getTime() - startTime,
				isError = typeof payload.code === 'number';

			messageReceived = true;

			showResponse(target, !isError, timeTaken + 'ms', payload);

			$executeBtn.attr('disabled', false).text('Execute');
		});

		ws.send(payload);

		appendWebsocketLog('> ' + payload);
	}

	function handleWebsocketResponse(requestId, handlerCallback) {
		websocketResponseHandlerMap[requestId] = handlerCallback;
	}

	function setRequestMode(id, name) {
		requestMode = id;

		$(document.body).removeClass(function (index, css) {
			return (css.match (/(^|\s)request-mode-\S+/g) || []).join(' ');
		}).addClass('request-mode-' + requestMode);

		$('#request-mode').html(name);
	}

	function showResponse(target, isSuccess, title, response) {
		var $responseTitle = $('.response-title[data-name="' + target + '"]'),
			$responseWrap = $('.response-wrap[data-name="' + target + '"]');

		$responseTitle.html(title).show();

		$responseWrap
			.removeClass('response-' + (isSuccess ? 'fail' : 'success'))
			.addClass('response-' + (isSuccess ? 'success' : 'fail'))
			.html(JSON.stringify(response, null, ' '))
			.show();
	}

	function isAtBottom(el) {
		return $(el).scrollTop() + $(el).innerHeight() >= el.scrollHeight;
	}

	function scrollToBottom(el) {
		$(el).scrollTop(el.scrollHeight);
	}

	function openDefaultNamespace() {
		var availableNamespaceNames = getAvailableNamespaceNames(),
			hash = window.location.hash,
			$firstNamespaceLink = $('.api-namespace-link:first'),
			firstNamespaceName = $firstNamespaceLink.data('name'),
			urlNamespaceName,
			dashPos;

		$('.navbar-brand')
			.attr('href', '#' + firstNamespaceName)
			.click(function() {
				openNamespace(firstNamespaceName);
			});

		if (hash.length > 0) {
			urlNamespaceName = hash.substr(1);
			dashPos = urlNamespaceName.indexOf('/');

			if (dashPos !== -1) {
				urlNamespaceName = urlNamespaceName.substr(0, dashPos);
			}

			if (availableNamespaceNames.indexOf(urlNamespaceName) !== -1) {
				return openNamespace(urlNamespaceName);
			}
		}

		openNamespace(firstNamespaceName);
	}

	function openNamespace(name) {
		var availableNamespaceNames = getAvailableNamespaceNames(),
			$namespaceLinks = $('.api-namespace-link'),
			$namespaceWraps = $('.api-namespace-wrap'),
			$selectedNamespaceLink = $('.api-namespace-link[data-name="' + name + '"]'),
			$selectedNamespaceWrap = $('.api-namespace-wrap[data-name="' + name + '"]');

		if (availableNamespaceNames.indexOf(name) === -1) {
			return false;
		}

		$namespaceWraps.hide();
		$namespaceLinks.removeClass('active');
		$selectedNamespaceLink.addClass('active');
		$selectedNamespaceWrap.show();

		return true;
	}

	function getAvailableNamespaceNames() {
		return $('.api-namespace-link').get().map(function(link) {
			return $(link).data('name');
		});
	}

	$(document).ready(function () {
		setRequestMode('rest', 'REST');
		setupWebsocket();
		setupApiNamespaceLinks();
		setupForms();
		setupRequestModeSwitching();
		openDefaultNamespace();
	});
})(jQuery);