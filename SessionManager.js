(function(context) {
	'use strict';

	var crypto = require('crypto'),
		extend = require('extend'),
		util = require('./Util'),
		log = require('logviking').logger.get('SessionInterface');

	var SessionManager = function() {
		this._sessions = {};
	};

	SessionManager.Error = SessionManager.prototype.Error = util.keyMirror({
		SESSION_NOT_FOUND: null,
		SESSION_EXPIRED: null
	});

	SessionManager.Session = function(info) {
		info = info || {};

		extend(this, info);

		this.id = info.id || this.generateSessionId();
		this.created = typeof this.created !== 'undefined' ? new Date(this.created) : new Date();
		this.updated = typeof this.updated !== 'undefined' ? new Date(this.updated) : new Date();
	};

	SessionManager.Session.prototype.isExpired = function() {
		var currentTimestamp = (new Date()).getTime(),
			updatedTimestamp = this.updated.getTime(),
			expireMilliseconds = 24 * 60 * 60 * 1000; // 24 hours

		return currentTimestamp - updatedTimestamp > expireMilliseconds;
	};

	SessionManager.Session.prototype.update = function() {
		this.updated = new Date();
	};

	SessionManager.Session.prototype.generateSessionId = function() {
		return crypto.randomBytes(32).toString('hex');
	};

	SessionManager.prototype.init = function() {
		this.onLoad();
	};

	SessionManager.prototype.create = function(info) {
		var session = new SessionManager.Session(info);

		this._sessions[session.id] = session;

		this.setupSession(session);

		log.info('created session', info, session);

		return session;
	};

	SessionManager.prototype.setupSession = function(session) {
		void(session);
	};

	SessionManager.prototype.get = function(sessionId, requireNotExpired) {
		requireNotExpired = typeof requireNotExpired === 'boolean' ? requireNotExpired : true;

		var session = this._sessions[sessionId];

		if (typeof session === 'undefined') {
			log.warn('session "' + sessionId + '" not found');

			return null;
		}

		if (requireNotExpired && session.isExpired()) {
			log.warn('session "' + sessionId + '" has expired');

			return null;
		}

		session.update();

		this.onUpdate(session);

		return session;
	};

	SessionManager.prototype.validate = function(sessionId) {
		var session = this.get(sessionId, false);

		if (session === null) {
			throw new Error(SessionManager.Error.SESSION_NOT_FOUND);
		}

		if (session.isExpired()) {
			throw new Error(SessionManager.Error.SESSION_EXPIRED);
		}

		return session;
	};

	SessionManager.prototype.onLoad = function() {}
	SessionManager.prototype.onUpdate = function(session) {}

	context.exports = SessionManager;
})(module);