(function(context) {
	'use strict';

	context.exports = {

		/**
		 * Does "forum-topic" to "ForumTopic" style conversion.
		 *
		 * @param {string} name Name to convert
		 * @returns {string}
		 * @memberof util
		 */
		convertEntityName: function(name) {
			var dashPos;

			while ((dashPos = name.indexOf('-')) != -1) {
				name = name.substr(0, dashPos) + (name.substr(dashPos + 1, 1)).toUpperCase() + name.substr(dashPos + 2);
			}

			return name.substr(0, 1).toUpperCase() + name.substr(1);
		},

		/**
		 * Does "forum-topic" to "forumTopic" style conversion.
		 *
		 * @param {string} name Name to convert
		 * @returns {string}
		 * @memberof util
		 */
        convertCallableName: function(name) {
            var dashPos;

            while ((dashPos = name.indexOf('-')) != -1) {
                name = name.substr(0, dashPos) + (name.substr(dashPos + 1, 1)).toUpperCase() + name.substr(dashPos + 2);
            }

            return name;
        },

		/**
		 * Constructs an enumeration with keys equal to their value.
		 *
		 * For example:
		 *
		 *   var COLORS = keyMirror({blue: null, red: null});
		 *   var myColor = COLORS.blue;
		 *   var isColorValid = !!COLORS[myColor];
		 *
		 * The last line could not be performed if the values of the generated enum were
		 * not equal to their keys.
		 *
		 *   Input:  {key1: val1, key2: val2}
		 *   Output: {key1: key1, key2: key2}
		 *
		 * https://github.com/STRML/keyMirror
		 *
		 * @param {object} obj Object whose keys to mirror
		 * @returns {object}
		 * @memberof util
		 */
		keyMirror: function (obj) {
			var ret = {},
				key;

			if (!(obj instanceof Object && !Array.isArray(obj))) {
				throw new Error('keyMirror(...): Argument must be an object.');
			}

			for (key in obj) {
				if (!obj.hasOwnProperty(key)) {
					continue;
				}
				ret[key] = key;
			}

			return ret;
		},

		getErrorStacktrace: function (e) {
			if (typeof e.stack !== 'string') {
				return 'unknown location';
			}

			var rows = e.stack.split('\n');

			return rows.join(' > ').replace(/    /g, '');
		}
	};
})(module);