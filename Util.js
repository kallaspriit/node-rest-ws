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
        }
	};
})(module);