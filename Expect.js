(function(context) {
	'use strict';

	var Errors = require('./Errors');

	var requireType = function(value, name, expectedTypes) {
			return function() {
				var realType = typeof value;

				if (!(expectedTypes instanceof Array)) {
					expectedTypes = [expectedTypes];
				}

				if (expectedTypes.indexOf(realType) === -1) {
					var expectedTypeNames;

					if (expectedTypes.length > 1) {
						expectedTypeNames = 'one of "' + expectedTypes.join('", "') + '"';
					} else {
						expectedTypeNames = '"' + expectedTypes[0] + '"';
					}

					throw new Errors.InvalidParameter(
						'Parameter "' + name + '" is expected to be ' + expectedTypeNames + ', but got a "' + realType + '"'
					);
				}

				return getValidators(value, name);
			};
		},
		getValidators = function(value, name) {
		if (typeof name !== 'string' || name.length === 0) {
			name = 'unknown';
		}

		var result = {
			notEmpty: function () {
				if (
					(typeof value === 'string' && value.length === 0)
					|| (value instanceof Array && value.length === 0)
				) {
					throw new Errors.InvalidParameter(
						'Parameter "' + name + '" is expected not to be empty'
					);
				}

				return getValidators(value, name);
			},

			toContain: function (ref) {
				if (!util.isArray(value) && !util.isObject(value)) {
					throw new Error(
						'Expected "' + value + '" (' + util.typeOf(value) +
						') to be a collection and contain "' + ref + '"'
					);
				}

				if (util.isArray(value) && value.indexOf(ref) === -1) {
					throw new Error('Expected "' + JSON.stringify(value) + '" to contain "' + ref + '"');
				} else if (util.isObject(value) && !_.contains(_.values(value), ref)) {
					throw new Error('Expected "' + JSON.stringify(value) + '" to contain "' + ref + '"');
				}
			},

			haveMinimumLength: function(minLength) {
				if (typeof value === 'string' && value.length < minLength) {
					throw new Errors.InvalidParameter(
						'Parameter "' + name + '" is expected to be at least ' + minLength + ' characters long'
					);
				}

				if (value instanceof Array && value.length < minLength) {
					throw new Errors.InvalidParameter(
						'Array "' + name + '" is expected to contain at least ' + minLength + ' elements'
					);
				}

				return getValidators(value, name);
			},

			string: requireType(value, name, ['string', 'number']),
			number: requireType(value, name, ['number']),
			boolean: requireType(value, name, ['boolean']),
			object: requireType(value, name, ['object']),
			array: requireType(value, name, ['array']),
		};

		result.toBe = result;
		result.and = result;

		return result;
	};

	context.exports = getValidators;
})(module);