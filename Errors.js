(function(context) {
	'use strict';

	var util = require('./Util'),
		inherits = require('util').inherits,
		Status = require('http-status');

	var createError = function(statusName, statusCode, defaultMessage) {
		var CustomError = function(message, filename, line) {
			Error.call(this, message, filename, line);
			Error.captureStackTrace(this, this.constructor);

			if (typeof defaultMessage !== 'string' && typeof Status[statusCode] !== 'undefined') {
				defaultMessage = Status[statusCode];
			}

			this.message = message || defaultMessage;
			this.statusName = statusName;
			this.statusCode = statusCode;
		};

		inherits(CustomError, Error);

		//CustomError.prototype = Object.create(Error.prototype);

		return CustomError;
	};

	var Errors = util.keyMirror({
		INVALID_PARAMETER: null,
		INTERNAL_ERROR: null,
		NOT_FOUND: null
	});

	Errors.InvalidParameter = createError(
		Errors.INVALID_PARAMETER,
		Status.BAD_REQUEST,
		'Invalid parameter provided'
	);
	Errors.InternalError = createError(
		Errors.INTERNAL_ERROR,
		Status.INTERNAL_SERVER_ERROR,
		'Internal error occured'
	);
	Errors.NotFound = createError(
		Errors.NOT_FOUND,
		Status.NOT_FOUND,
		'Not found'
	);

	Errors.Status = Status;
	Errors.createError = createError;

	context.exports = Errors;
})(module);