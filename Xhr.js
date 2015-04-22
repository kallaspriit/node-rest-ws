var xhrRequest = (function() {
	// use jQuery ajax implementation if possible
	if (typeof window.jQuery !== 'undefined' && typeof window.jQuery.ajax === 'function') {
		return function(method, url, data) {
			method = method.toLowerCase();

			return window.jQuery.ajax({
				url: url,
				type: method,
				data: method === 'post' ? data : null,
				xhrFields: {
					withCredentials: true
				}
			});
		};
	}

	var serialize = function (obj, prefix) {
		var str = [];
		for (var p in obj) {
			if (obj.hasOwnProperty(p)) {
				var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
				str.push(typeof v == "object" ?
					serialize(v, k) :
				encodeURIComponent(k) + "=" + encodeURIComponent(v));
			}
		}
		return str.join("&");
	};

	return function(method, url, data) {
		var promise = new Promise(),
			request = new XMLHttpRequest();

		method = method.toUpperCase();

		request.onreadystatechange = function() {
			if (request.readyState == XMLHttpRequest.DONE) {
			   if (request.status == 200) {
				   promise.resolve()
				   document.getElementById("myDiv").innerHTML = request.responseText;
			   }
			   else if(request.status == 400) {
				  alert('There was an error 400')
			   }
			   else {
				   alert('something else other than 200 was returned')
			   }
			}
		}

		request.open(method, url, true);

		if (method === 'POST') {
			if (typeof data !== 'string') {
				data = serialize(data);
			}

			request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
			request.setRequestHeader('Content-length', data.length);
			request.setRequestHeader('Connection', 'close');
			request.send(data);
		} else {
			request.send();
		}

		return promise.promise();
	};
})();