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
		if (day == "2" || day == "tomorrow") {
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

	function _sayResults(convoData, convo, gc) {
		_search(convoData, convo, gc, function(locations) {
			var text;
			if (locations != null && locations.length > 0) {
				var day = convo.extractResponse(convoData.askDay.convoKey);
				if (day == "1") {
					day = "today";
				} else if (day == "2") {
					day = "tomorrow";
				}

				var location;
				var locationType = convo.extractResponse(convoData.askLocationType.convoKey);
				if (locationType == "1" || locationType == "address") {
					location = convo.extractResponse(convoData.askAddress.convoKey);
				} else if (locationType == "2" || locationType == "intersection") {
					var street1 = convo.extractResponse(convoData.askIntersection1.convoKey);
					var street2 = convo.extractResponse(convoData.askIntersection2.convoKey);
					location = street1 + " and " + street2;
				} else if (locationType == "3" || locationType == "school") {
					location = convo.extractResponse(convoData.askPlace.convoKey);
				}

				text = util.format(convoData.results, location, day);

				locations.forEach(function(loc) {
					text += loc.name;
					text += "\n";
					text += loc.address;
					text += "\n\n";
				});
			} else {
				text = convoData.noResults;
			}

			convo.say(text + convoData.goodbye);
			convo.next();
		});
	}

	/**
	 * The Bot asks the user for their current address in order to determine their current
	 * location, and if geocoded successfully, presents the user with the results.
	 */
	function _askAddress(convoData, convo) {
		var askAddress = convoData.askAddress;
		convo.ask(askAddress.text, function(response, convo) {
			Geocoding.geocodeLocality(response.text, "Calgary", function(err, gc) {
				if (!err) {
					_sayResults(convoData, convo, gc);
				} else {
					var errorMessage = util.format(askAddress.errorFormat, response.text);
					_askLocationType(convoData, convo, errorMessage);
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
	function _askIntersection(convoData, convo) {
		var askIntersection1 = convoData.askIntersection1;
		convo.ask(askIntersection1.text, function(response, convo) {
			var street1 = response.text;
			var askIntersection2 = convoData.askIntersection2;
			convo.ask(askIntersection2.text, function(response, convo) {
				var street2 = response.text;
				var intersectionAddress = street1 + " & " + street2;
				Geocoding.geocodeLocality(intersectionAddress, "Calgary", function(err, gc) {
					if (!err) {
						_sayResults(convoData, convo, gc);
					} else {
						var errorMessage = util.format(askIntersection2.errorFormat, street1, street2);
						_askLocationType(convoData, convo, errorMessage);
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
	function _askPlace(convoData, convo) {
		var askPlace = convoData.askPlace;
		convo.ask(askPlace.text, function(response, convo) {
			var place = response.text.toLowerCase();
			var placeKey = places[place];
			if (placeKey != null) {
				var geocode = geocodings[placeKey];
				if (geocode != null && geocode != undefined) {
					_sayResults(convoData, convo, geocode);
				} else {
					console.log("!! No geocode for place: " + place);
					var errorMessage = util.format(askPlace.errorFormat, response.text);
					_askLocationType(convoData, convo, errorMessage);
					convo.next();
				}
			} else {
				var errorMessage = util.format(askPlace.errorFormat, response.text);
				_askLocationType(convoData, convo, errorMessage);
				convo.next();
			}
			return true; // NOTE(christian): For test purposes only. See remarks in test_convo.js.
		}, {key: askPlace.convoKey});
	}

	/**
	 * The Bot asks the user how they wish to let it know what their current location is.
	 */
	function _askLocationType(convoData, convo, prefix) {
		var askLocationType = convoData.askLocationType;
		var askText = prefix + askLocationType.text;
		convo.ask(askText, function(response, convo) {
			if (askLocationType.validResponses.includes(response.text.toLowerCase())) {
				var locationType = response.text.toLowerCase();
				if (locationType == "1" || locationType == "address") {
					_askAddress(convoData, convo);
				} else if (locationType == "2" || locationType == "intersection") {
					_askIntersection(convoData, convo);
				} else if (locationType == "3" || locationType == "school") {
					_askPlace(convoData, convo);
				} else {
					console.log("!! Unknown location type as valid response!");
				}

				convo.next();
			}
		}, {key: askLocationType.convoKey});
	}

	/**
	 * Initiates a conversation instance with the Bot where it greets the user
	 * and asks the first question.
	 */
	function _startConversation(convo) {
		Parse.initialize(process.env.PARSE_APPID, process.env.PARSE_JAVASCRIPTKEY);
		Parse.serverURL = process.env.PARSE_SERVERURL;

		var greeting = convoData.greeting;
		var askDay = convoData.askDay;
		var fullGreeting = greeting + askDay.text;

		convo.ask(fullGreeting, function(response, convo) {
			convo.setTimeout(_timeoutMilliseconds);
			convo.onTimeout(function(convo) {
				convo.say(convoData.timeout);
				convo.stop();
			});

			if (askDay.validResponses.includes(response.text.toLowerCase())) {
				_askLocationType(convoData, convo, "");
				convo.next();
			}
		}, {key: askDay.convoKey});
	}

	module.exports = {
		hears: _hears,
		startConversation: _startConversation
	};
})(module);
