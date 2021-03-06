(function(module) {
	"use strict";

	var
		Parse = require("parse/node"),
		TestConvo = require("./test_convo.js"),
		convoData = require("./data/ffyyc_bot.json");


	/**
	 * Calculates statistics on session times for all users. Only the total session time is used
	 * (i.e. the time of the last convo event, which represents the total time taken for the session).
	 * Returns a JSON object in the format:
	 * {"min": xxx, "max": xxx, "mean": xxx}
	 */
  function _calculateSessionTimes(callback) {
    var sessionTimes = {};
    var closing = convoData.closing;

    var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
    query.equalTo("convoId", closing.convoId);
    query.find({
      success: function(results) {
        if (results.length > 0) {
					var min = Number.MAX_VALUE;
	        var max = Number.MIN_VALUE;
	        var sum = 0;

          for (var i = 0; i < results.length; i++) {
            var entry = results[i];
            var sessionTime = entry.get("time");
            sum += sessionTime;
            min = (sessionTime < min ? sessionTime : min);
            max = (sessionTime > max ? sessionTime : max);
          }
          sessionTimes.min = min;
          sessionTimes.max = max;
          sessionTimes.mean = (sum / results.length);
        }

        callback(sessionTimes, null);
      },
      error: function(error) {
        console.error(error);
        callback(null, error);
      }
    });
  }

	/**
	 * Counts the number of invalid responses accross all users.
	 */
	function _countInvalidResponses(callback) {
		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
		query.equalTo("validResponse", false);
		query.count({
			success: function(count) {
				if (callback != null) {
					callback(count, null);
				}
			},
			error: function(error) {
				console.error(error);
				callback(0, error);
			}
		});
	}

	/**
	 * Counts the number of choices made by users for each type of location, and returns a JSON object in the form:
	 * {"addresses": xxx, "intersections": xxx, "places": xxx}
	 */
	function _countLocationChoices(callback) {
		var askAddress = convoData.askAddress;
		var askIntersection1 = convoData.askIntersection1;
		var askPlace = convoData.askPlace;
		var locationChoices = {};

		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var addressQuery = new Parse.Query(ConvoEvent);
		addressQuery.equalTo("convoId", askAddress.convoId);
		var intersectionQuery = new Parse.Query(ConvoEvent);
		intersectionQuery.equalTo("convoId", askIntersection1.convoId);
		var schoolQuery = new Parse.Query(ConvoEvent);
		schoolQuery.equalTo("convoId", askPlace.convoId);

		var query = new Parse.Query.or(addressQuery, intersectionQuery, schoolQuery);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
		query.find({
			success: function(results) {
				var addressChoices = 0;
				var intersectionChoices = 0;
				var placeChoices = 0;

				for (var i = 0; i < results.length; i++) {
					var entry = results[i];
					if (entry.get("convoId") == askAddress.convoId) {
						addressChoices++;
					} else if (entry.get("convoId") == askIntersection1.convoId) {
						intersectionChoices++;
					} else if (entry.get("convoId") == askPlace.convoId) {
						placeChoices++;
					}
				}

				locationChoices.addresses = addressChoices;
				locationChoices.intersections = intersectionChoices;
				locationChoices.places = placeChoices;
				callback(locationChoices, null);
			},
			error: function(error) {
				console.error(error);
				callback(null, error);
			}
		});
	}

	/**
	 * Counts the number of events where no geocodes were found for some location input, and returns a JSON object in the form:
	 * {"addresses": xxx, "intersections": xxx, "places": xxx, "count": xxx}
	 */
	function _countGeocodesNotFound(callback) {
		var askAddress = convoData.askAddress;
		var askIntersection2 = convoData.askIntersection2;
		var askPlace = convoData.askPlace;
		var noGeocodes = {};

		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
		query.equalTo("geocodeFound", false);
		query.find({
			success: function(results) {
				var addressesNotFound = 0;
				var intersectionsNotFound = 0;
				var placesNotFound = 0;

				for (var i = 0; i < results.length; i++) {
					var entry = results[i];
					if (entry.get("convoId") == askAddress.convoId) {
						addressesNotFound++;
					} else if (entry.get("convoId") == askIntersection2.convoId) {
						intersectionsNotFound++;
					} else if (entry.get("convoId") == askPlace.convoId) {
						placesNotFound++;
					}
				}

				noGeocodes.addresses = addressesNotFound;
				noGeocodes.intersections = intersectionsNotFound;
				noGeocodes.places = placesNotFound;
				noGeocodes.count = results.length;
				callback(noGeocodes, null);
			},
			error: function(error) {
				console.error(error);
				callback(null, error);
			}
		});
	}

	/**
	 * Counts the number of instances where a location was not found given a location's geocode, and returns a JSON
	 * object containing the total count and a list of search parameters where a location was not found:
	 * {"count": xxx, "searchParams": [...]}
	 */
	function _countLocationsNotFound(callback) {
		var closing = convoData.closing;
		var noLocations = {};

		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
		query.equalTo("convoId", closing.convoId);
		query.equalTo("locationsFound", false);
		query.find({
			success: function(results) {
				var searchParams = [];

				for (var i = 0; i < results.length; i++) {
					var entry = results[i];
					var param = {};
					param.geocode = entry.get("geocode");
					param.searchDate = entry.get("searchDate");
					searchParams.push(param);
				}

				noLocations.count = results.length;
				noLocations.searchParams = searchParams;
				callback(noLocations, null);
			},
			error: function(error) {
				console.error(error);
				callback(null, error);
			}
		});
	}

	/**
	 * Calculates statistics on all sessions that have been logged to the database, and returns a JSON object of the form:
	 * {"min": xxx, "max": xxx, "mean": xxx", "userSessions": {"user": xxx, ...}}
	 */
	function _calculateSessionStats(users, callback) {
		var sessions = {};
    var userSessions = {};
    if (users.size > 0) {
			let min = Number.MAX_VALUE;
			let max = Number.MIN_VALUE;
			let sum = 0;

			let usersCompleted = 0;
  		for (let user of users) {
  			var ConvoEvent = Parse.Object.extend("ConvoEvent");
  			var userQuery = new Parse.Query(ConvoEvent);
  			userQuery.equalTo("user", user);
  			userQuery.descending("userSession");
  			userQuery.find({
  				success: function(results) {
						var sessionCount = 0;
  					if (results.length > 0) {
  						var latest = results[0];
  						sessionCount = latest.get("userSession");
  					}
						userSessions[user] = sessionCount;
						min = (sessionCount < min ? sessionCount : min);
						max = (sessionCount > max ? sessionCount : max);
						sum += sessionCount;

  					usersCompleted++;
  					if (usersCompleted == users.size) {
							sessions.count = sum;
							sessions.min = min;
							sessions.max = max;
							sessions.mean = (sum / users.size);
							sessions.userSessions = userSessions;

  						callback(sessions, null);
  					}
  				},
  				error: function(error) {
  					console.error(error);
  					callback(null, error);
  				}
  			});
  		}
    } else {
      callback(userSessions, null);
    }
	}

	/**
	 * Calculates user-specific statistics, and returns the total user count and a sessions JSON object in the callback
	 * (see remarks for _calculateSessionStats).
	 */
	function _getUserStats(callback) {
		var askDay = convoData.askDay;

		// NOTE(christian): Query used to get list of users (identified by their phone number). Only the first session and
		// initial convo is needed to retrieve a list of all users.
		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
    query.equalTo("userSession", 1);
    query.equalTo("convoId", askDay.convoId);
		query.find({
			success: function(results) {
        var users = new Set();
				for (var i = 0; i < results.length; i++) {
					var entry = results[i];
					users.add(entry.get("user"));
				}

				_calculateSessionStats(users, function(sessions, error) {
					callback(users.size, sessions, error);
				});
			},
			error: function(error) {
				console.error(error);
				callback(0, null, error);
			}
		});
	}

	/**
	 * Calculates statistics on the activity of the Bot and returns a JSON object in the given callback.
	 */
	function _getStats(callback) {
		Parse.initialize(process.env.PARSE_APPID, process.env.PARSE_JAVASCRIPTKEY, process.env.PARSE_MASTERKEY);
		Parse.serverURL = process.env.PARSE_SERVERURL;

		var stats = {};

		let tasksCompleted = 0;
		let totalTasks = 6;
		var errors = [];

		function completeIfAllTasksDone(err) {
			if (err != null && err != undefined) {
				errors.push(err);
			}

			tasksCompleted++;
			if (tasksCompleted == totalTasks) {
				callback(stats, (errors.length == 0 ? null : errors));
			}
		}

		_getUserStats(function(userCount, sessions, error) {
			stats.userCount = userCount;
			stats.sessions = sessions;
			completeIfAllTasksDone(error);
		});

		_countInvalidResponses(function(count, error) {
			stats.invalidResponses = count;
      completeIfAllTasksDone(error);
		});

		_countLocationChoices(function(locationChoices, error) {
			stats.locationChoices = locationChoices;
			completeIfAllTasksDone(error);
		});

		_countGeocodesNotFound(function(noGeocodes, error) {
			stats.noGeocodes = noGeocodes;
			completeIfAllTasksDone(error);
		});

		_countLocationsNotFound(function(noLocations, error) {
			stats.noLocations = noLocations;
			completeIfAllTasksDone(error);
		});

    _calculateSessionTimes(function(sessionTimes, error) {
      stats.sessionTimes = sessionTimes;
      completeIfAllTasksDone(error);
    });
	}

	module.exports = {
		getStats: _getStats
	};
})(module);
