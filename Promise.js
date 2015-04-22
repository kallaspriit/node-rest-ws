var Promise = (function() {
	// use jQuery deferred implementation if possible
	if (typeof window.jQuery !== 'undefined' && typeof window.jQuery.Deferred === 'function') {
		return window.jQuery.Deferred;
	}

	// use minimal promises based on https://gist.github.com/814052/690a6b41dc8445479676b347f1ed49f4fd0b1637
	var Promise = function() {
			this._thens = [];
		};

	Promise.prototype = {

		then: function (onResolve, onReject) {
			this._thens.push({
				resolve: onResolve,
				reject: onReject
			});

			return this;
		},

		done: function (onResolve) {
			return this.then(onResolve, null);
		},

		fail: function (onReject) {
			return this.then(null, onReject);
		},

		resolve: function (val) {
			this._complete('resolve', val);
		},

		reject: function (ex) {
			this._complete('reject', ex);
		},

		promise: function() {
			return this;
		},

		_complete: function (which, arg) {
			var aThen,
				i = 0;

			this.then = which === 'resolve'
				? function (resolve) { resolve(arg); }
				: function (resolve, reject) { reject(arg); };

			this.resolve = this.reject = function () {
				throw new Error('Promise already completed.');
			};

			while ((aThen = this._thens[i++])) {
				if (aThen[which]) {
					aThen[which](arg);
				}
			}

			delete this._thens;
		}
	};

	return Promise;
})();