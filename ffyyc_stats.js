(function(module) {
	"use strict";

	var
		Parse = require("parse/node"),
		convoData = require("./data/ffyyc_bot.json");


	/**
	 * Calculates statistics on session times for all users. Only the total session time is used
	 * (i.e. the time of the last convo event, which represents the total time taken for the session).
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
        var min = Number.MAX_VALUE;
        var max = Number.MIN_VALUE;
        var sum = 0;
        if (results.length > 0) {
          for (var i = 0; i < results.length; i++) {
            var entry = results[i];
            var sessionTime = entry.get("time");
            sum += sessionTime;
            min = (sessionTime < min ? sessionTime : min);
            max = (sessionTime > max ? sessionTime : max);
          }
          sessionTimes.min = min;
          sessionTimes.max = max;
          sessionTimes.average = (sum / results.length);
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
	 * Counts the number of sessions for each user and returns a JSON object in the form:
	 * {"user": sessionCount}
	 */
	function _countUserSessions(users, callback) {
    var userSessions = {};
    if (users.size > 0) {
  		let usersCompleted = 0;
  		for (let user of users) {
  			var ConvoEvent = Parse.Object.extend("ConvoEvent");
  			var userQuery = new Parse.Query(ConvoEvent);
  			userQuery.equalTo("user", user);
  			userQuery.descending("userSession");
  			userQuery.find({
  				success: function(results) {
  					if (results.length > 0) {
  						var latest = results[0];
  						userSessions[user] = latest.get("userSession");
  					} else {
  						userSessions[user] = 0;
  					}
  					usersCompleted++;
  					if (usersCompleted == users.size) {
  						callback(userSessions, null);
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
	 * Calculates statistics on the activity of the Bot and returns a JSON object in the given callback.
	 */
	function _getStats(callback) {
		Parse.initialize(process.env.PARSE_APPID, process.env.PARSE_JAVASCRIPTKEY, process.env.PARSE_MASTERKEY);
		Parse.serverURL = process.env.PARSE_SERVERURL;

		var TestConvo = require("./test_convo.js");
    var askDay = convoData.askDay;
		var askAddress = convoData.askAddress;
		var askIntersection1 = convoData.askIntersection1;
		var askIntersection2 = convoData.askIntersection2;
		var askPlace = convoData.askPlace;

    // NOTE(christian): Query used to get list of users (identified by their phone number). Only the first session and
		// initial convo is needed to retrieve a list of all users.
		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.notEqualTo("user", TestConvo.PHONE_NUMBER);
    query.equalTo("userSession", 1);
    query.equalTo("convoId", askDay.convoId);
		query.find({
			success: function(results) {
				var stats = {};

        if (results.length > 0) {
          var users = new Set();
  				for (var i = 0; i < results.length; i++) {
  					var entry = results[i];
  					users.add(entry.get("user"));
  				}
  				stats.userCount = users.size;

  				let tasksCompleted = 0;
  				let totalTasks = 3;
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

  				_countInvalidResponses(function(count, error) {
  					stats.invalidResponses = count;
            completeIfAllTasksDone(error);
  				});

  				_countUserSessions(users, function(userSessions, error) {
  					stats.userSessions = userSessions;

            if (userSessions != null && userSessions != undefined) {
              var totalSessions = 0;
    					for (var key of Object.keys(userSessions)) {
    						totalSessions += userSessions[key];
    					}
    					stats.totalSessions = totalSessions;
            }

  					completeIfAllTasksDone(error);
  				});

          _calculateSessionTimes(function(sessionTimes, error) {
            stats.sessionTimes = sessionTimes;
            completeIfAllTasksDone(error);
          });
        } else {
          callback(stats, null);
        }
			},
			error: function(error) {
				console.error(error);
				callback(null, [error]);
			}
		});
	}

	module.exports = {
		getStats: _getStats
	};
})(module);
