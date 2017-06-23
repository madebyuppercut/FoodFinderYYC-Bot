(function(module) {
	"use strict";

	var
		util = require("util"),
		Geocoding = require("./geocoding.js"),
		Parse = require("parse/node"),
		convoData = require("./data/ffyyc_bot.json"),
		places = require("./data/places.json"),
		geocodings = require("./data/geocodings.json"),
		_hears = ["FOOD", "food", ".*"],
		_timeoutMilliseconds = 300000, // 5 minutes
		_searchRadius = 1000; // 1000 km, effectively no distance limit!


	/**
	 * Searches the Parse database with the given geocode along with a search
	 * date for locations closest to the user. If successful, this function returns
	 * at most 3 (closest) locations in the completion callback.
	 */
	function _search(convoData, convo, gc, completion) {
		var askDay = convoData.askDay;
		var currentDate = new Date();
		var searchDate = new Date();

		var day = convo.extractResponse(askDay.convoKey);
		if (day == "2" || day == "\"2\"" || day == "tomorrow") {
			searchDate.setDate(searchDate.getDate() + 1);
		}

		// NOTE(christian): Don't restrict by meal types, so include them all.
		var searchMealTypes = ["lunch", "hamper", "snacks", "dinner"];

		Parse.Cloud.run("search", {
			date: searchDate.toString(),
			dateTimeNow: currentDate.toString(),
			meals: searchMealTypes,
			distance: _searchRadius,
			geolocation: {latitude: gc.lat, longitude: gc.lon}
		}, {
			success: function(locations) {
				var locs = [];
				var locBound = Math.min(3, locations.length);
				for (var i = 0; i < locBound; i++) {
					var loc = locations[i];
					locs.push({name: loc.object.get("name"), address: loc.object.get("address")});
				}
				completion(locs);
			},
			error: function(error) {
				console.log("!! Error running 'search' on Parse: " + error);
				completion(null);
			}
		});
	}

	/**
	 * Logs a conversation event to the database with the given ID, user response, and flag whether the user response
	 * was valid. The events logged to the database can be used to gather statistics on the Bot and how users interact with it.
	 * @param user The user object used to identify the event. If null, the event is not logged to the database.
	 * @param convoId The ID of the conversation where this event originated from. This value should not be null.
	 * @param params (Optional) A JSON object that identifies custom parameters for the convo event. Supported keys
	 *	and corresponding value types are:
	 *	- response (string): the user's response text
	 *	- validReponse (boolean): whether the user's response was valid
	 *	- locationsFound (boolean): whether locations were found for the search given the location type and user's input
	 */
	function _addConvoEvent(user, convoId, params) {
		if (user != null) {
			var now = new Date();
			var elapsedSeconds = (now.getTime() - user.startTime.getTime()) / 1000;

			var ConvoEvent = Parse.Object.extend("ConvoEvent");
			var event = new ConvoEvent();
			event.set("user", user.phoneNumber);
			event.set("userSession", user.sessionNumber);
			event.set("convoId", convoId);
			event.set("time", elapsedSeconds);
			if (params != null && params != undefined) {
				event.set("userResponse", params.response);
				event.set("validResponse", params.validResponse);
				event.set("locationsFound", params.locationsFound);
			}

			event.save(null, {
				success: function(obj) {
					// No op
				},
				error: function(error) {
					console.error("Failed to save ConvoEvent:");
					console.error(error);
				}
			});
		}
	}

	function _sayResults(user, convoData, convo, gc) {
		_search(convoData, convo, gc, function(locations) {
			var text;
			var closing = convoData.closing;
			if (locations != null && locations.length > 0) {
				var day = convo.extractResponse(convoData.askDay.convoKey);
				if (day == "1" || day == "\"1\"") {
					day = "today";
				} else if (day == "2" || day == "\"2\"") {
					day = "tomorrow";
				}

				var location;
				var locationType = convo.extractResponse(convoData.askLocationType.convoKey);
				if (locationType == "1" || locationType == "\"1\"" || locationType == "address") {
					location = convo.extractResponse(convoData.askAddress.convoKey);
				} else if (locationType == "2" || locationType == "\"2\"" || locationType == "intersection") {
					var street1 = convo.extractResponse(convoData.askIntersection1.convoKey);
					var street2 = convo.extractResponse(convoData.askIntersection2.convoKey);
					location = street1 + " and " + street2;
				} else if (locationType == "3" || locationType == "\"3\"" || locationType == "school") {
					location = convo.extractResponse(convoData.askPlace.convoKey);
				}

				text = util.format(closing.results, location, day);

				locations.forEach(function(loc) {
					text += loc.name;
					text += "\n";
					text += loc.address;
					text += "\n\n";
				});
			} else {
				text = closing.noResults;
			}

			_addConvoEvent(user, closing.convoId);

			convo.say(text + closing.goodbye);
			convo.next();
		});
	}

	/**
	 * The Bot asks the user for their current address in order to determine their current
	 * location, and if geocoded successfully, presents the user with the results.
	 */
	function _askAddress(user, convoData, convo) {
		var askAddress = convoData.askAddress;
		convo.ask(askAddress.text, function(response, convo) {
			Geocoding.geocodeLocality(response.text, "Calgary", function(err, gc) {
				if (!err) {
					_addConvoEvent(user, askAddress.convoId, {response: response.text, locationsFound: true});
					_sayResults(user, convoData, convo, gc);
				} else {
					_addConvoEvent(user, askAddress.convoId, {response: response.text, locationsFound: false});
					var errorMessage = util.format(askAddress.errorFormat, response.text);
					_askLocationType(user, convoData, convo, errorMessage);
					convo.next();
				}
			});
			return true; // NOTE(christian): For test purposes only. See remarks in test_convo.js.
		}, {key: askAddress.convoKey});
	}

	/**
	 * The Bot asks the user what intersection they are at in order to determine their
	 * current location, and if geocoded successfully, presents the user with the results.
	 */
	function _askIntersection(user, convoData, convo) {
		var askIntersection1 = convoData.askIntersection1;
		convo.ask(askIntersection1.text, function(response, convo) {
			_addConvoEvent(user, askIntersection1.convoId, {response: response.text});

			var street1 = response.text;
			var askIntersection2 = convoData.askIntersection2;
			convo.ask(askIntersection2.text, function(response, convo) {
				var street2 = response.text;
				var intersectionAddress = street1 + " & " + street2;
				Geocoding.geocodeLocality(intersectionAddress, "Calgary", function(err, gc) {
					if (!err) {
						_addConvoEvent(user, askIntersection2.convoId, {response: response.text, locationsFound: true});
						_sayResults(user, convoData, convo, gc);
					} else {
						_addConvoEvent(user, askIntersection2.convoId, {response: response.text, locationsFound: false});
						var errorMessage = util.format(askIntersection2.errorFormat, street1, street2);
						_askLocationType(user, convoData, convo, errorMessage);
						convo.next();
					}
				});
				return true; // NOTE(christian): For test purposes only. See remarks in test_convo.js.
			}, {key: askIntersection2.convoKey});
			convo.next();
		}, {key: askIntersection1.convoKey});
	}

	/**
	 * The Bot asks the user what place they are close to in order to determine their
	 * current location, and if the place is found, presents the user with the results.
	 */
	function _askPlace(user, convoData, convo) {
		var askPlace = convoData.askPlace;
		convo.ask(askPlace.text, function(response, convo) {
			var place = response.text.toLowerCase();
			var placeKey = places[place];
			if (placeKey != null) {
				var geocode = geocodings[placeKey];
				if (geocode != null && geocode != undefined) {
					_addConvoEvent(user, askPlace.convoId, {response: response.text, locationsFound: true});
					_sayResults(user, convoData, convo, geocode);
				} else {
					console.log("!! No geocode for place: " + place);
					_addConvoEvent(user, askPlace.convoId, {response: response.text, locationsFound: false});
					var errorMessage = util.format(askPlace.errorFormat, response.text);
					_askLocationType(user, convoData, convo, errorMessage);
					convo.next();
				}
			} else {
				_addConvoEvent(user, askPlace.convoId, {response: response.text, locationsFound: false});
				var errorMessage = util.format(askPlace.errorFormat, response.text);
				_askLocationType(user, convoData, convo, errorMessage);
				convo.next();
			}
			return true; // NOTE(christian): For test purposes only. See remarks in test_convo.js.
		}, {key: askPlace.convoKey});
	}

	/**
	 * The Bot asks the user how they wish to let it know what their current location is.
	 */
	function _askLocationType(user, convoData, convo, prefix) {
		var askLocationType = convoData.askLocationType;
		var askText = prefix + askLocationType.text;
		convo.ask(askText, function(response, convo) {
			if (askLocationType.validResponses.includes(response.text.toLowerCase())) {
				_addConvoEvent(user, askLocationType.convoId, {response: response.text, validResponse: true});

				var locationType = response.text.toLowerCase();
				if (locationType == "1" || locationType == "\"1\"" || locationType == "address") {
					_askAddress(user, convoData, convo);
				} else if (locationType == "2" || locationType == "\"2\"" || locationType == "intersection") {
					_askIntersection(user, convoData, convo);
				} else if (locationType == "3" || locationType == "\"3\"" || locationType == "school") {
					_askPlace(user, convoData, convo);
				} else {
					console.log("!! Unknown location type as valid response!");
				}

				convo.next();
			} else {
				_addConvoEvent(user, askLocationType.convoId, {response: response.text, validResponse: false});
			}
		}, {key: askLocationType.convoKey});
	}

	/**
	 * Starts the conversation with the Bot's greeting and first question. If the user parameter is non-null,
	 * it will be used to track user responses in the database.
	 */
	function _startWithUser(user, convoData, convo) {
		var greeting = convoData.greeting;
		var askDay = convoData.askDay;
		var fullGreeting = greeting + askDay.text;

		convo.ask(fullGreeting, function(response, convo) {
			if (askDay.validResponses.includes(response.text.toLowerCase())) {
				_addConvoEvent(user, askDay.convoId, {response: response.text, validResponse: true});
				_askLocationType(user, convoData, convo, "");
				convo.next();
			} else {
				_addConvoEvent(user, askDay.convoId, {response: response.text, validResponse: false});
			}
		}, {key: askDay.convoKey});
	}

	/**
	 * Initiates the conversation between the user and Bot with the given convo object received from Botkit.
	 */
	function _startConversation(convo) {
		convo.setTimeout(_timeoutMilliseconds);
		convo.onTimeout(function(convo) {
			convo.say(convoData.timeout);
			convo.stop();
		});

		Parse.initialize(process.env.PARSE_APPID, process.env.PARSE_JAVASCRIPTKEY, process.env.PARSE_MASTERKEY);
		Parse.serverURL = process.env.PARSE_SERVERURL;

		var user = {};
		user.phoneNumber = convo.source_message.user;
		user.startTime = new Date();

		var ConvoEvent = Parse.Object.extend("ConvoEvent");
		var query = new Parse.Query(ConvoEvent);
		query.equalTo("user", user.phoneNumber);
		query.descending("userSession");
		query.find({
			success: function(results) {
				if (results.length > 0) {
					var latest = results[0];
					user.sessionNumber = latest.get("userSession") + 1;
				} else {
					user.sessionNumber = 1;
				}
				_startWithUser(user, convoData, convo);
			},
			error: function(error) {
				console.error(error);
				_startWithUser(null, convoData, convo);
			}
		});
	}

	module.exports = {
		hears: _hears,
		startConversation: _startConversation
	};
})(module);
