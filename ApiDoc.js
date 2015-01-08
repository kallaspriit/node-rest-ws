(function(context) {
	'use strict';

	var fs = require('fs');

	function ApiDoc(filename) {
		this._raw = JSON.parse(fs.readFileSync(filename, {
			encoding: 'utf-8'
		}));
	}

	ApiDoc.prototype.getClassInfo = function(className) {
		var classInfo,
			i;

		for (i = 0; i < this._raw.classes.length; i++) {
			classInfo = this._raw.classes[i];

			if (classInfo.name === className) {
				return classInfo;
			}
		}

		return null;
	};

	ApiDoc.prototype.getMethodInfo = function(className, methodName) {
		var classInfo = this.getClassInfo(className),
			functionInfo,
			i;

		if (classInfo === null || !(classInfo.functions instanceof Array)) {
			return null;
		}

		for (i = 0; i < classInfo.functions.length; i++) {
			functionInfo = classInfo.functions[i];

			if (functionInfo.name === methodName) {
				return functionInfo;
			}
		}

		return null;
	};

	context.exports = ApiDoc;
})(module);