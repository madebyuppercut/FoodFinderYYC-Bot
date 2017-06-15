(function(module) {
	"use strict";

	var
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
				console.error("Error running 'search' on Parse: " + error);
				completion(null);
			}
		});
	}

	function _sayResults(convoData, convo, gc) {
		_search(convoData, convo, gc, function(locations) {
			if (locations != null && locations.length > 0) {
				var text = "Here are the closest locations to you:\n";
				locations.forEach(function(loc) {
					text += loc.name;
					text += "\n";
					text += loc.address;
					text += "\n";
				});
			} else{
				var text = "No locations were found.";
			}

			convo.say(text + "\n" + convoData.goodbye);
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
					_askLocationType(convoData, convo, "Could not geocode address " + response.text + ". Please try again. ");
				}
			});
			convo.next();
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
						_askLocationType(convoData, convo, "Could not geocode intersection " + response.text + ". Please try again. ");
					}
				});
				convo.next();
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
				}
			} else {
				_askLocationType(convoData, convo, "Could not find " + response.text + ". Please try again. ");
			}
			convo.next();
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
				} else if (locationType == "3" || locationType == "place") {
					_askPlace(convoData, convo);
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
		convo.say("Food Finder YYC will be live July 3. Check our main site foodfinderyyc.com and leave an email address to be reminded when we launch.");

/* NOTE(christian): Disable for now, and only reply with temporary auto-response.
		Parse.initialize(config.appId, config.javascriptKey);
		Parse.serverURL = config.serverURL;

		var greeting = convoData.greeting;
		var askDay = convoData.askDay;
		var fullGreeting = greeting + " " + askDay.text;

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
	*/
	}

	module.exports = {
		hears: _hears,
		startConversation: _startConversation
	};
})(module);
