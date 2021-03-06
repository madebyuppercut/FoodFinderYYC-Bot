(function(module) {
	"use strict";

	var googleLocal;
	if (process.env.NODE_ENV == "local") {
		googleLocal = require("./local/google.json");
	}

	var googleMapsClient = require("@google/maps").createClient({
		key: process.env.GOOGLE_APIKEY || googleLocal.apiKey
	});

	/**
	 * Geocodes the given address within a locality.
	 *
	 * @param {String} addr The address to geocode. It does not need to (and should not
 	 *	contain) city, province, or postal code, since the locality parameter takes care of that.
	 * @param {String} loc The locality (city) that the address is located in.
	 * @param {function} callback The function to call when geocoding has returned.
	 */
	function _geocodeLocality(addr, loc, callback) {
		var params = {address: addr};
		if (loc != null && loc != undefined && loc != "") {
			params["components"] = {locality: loc};
		}

		googleMapsClient.geocode(params, function(err, response) {
			if (!err) {
				var results = response.json.results;
				if (results && results.length > 0) {
					var firstResult = results[0];
					var locationGeometry = firstResult.geometry;
					if (locationGeometry.location_type == "ROOFTOP" || firstResult.types.includes("intersection")) {
						// NOTE(christian): The location type returns "ROOFTOP" for dead-on geocodes. Anything else is not
						// accurate enough for street addresses or buildings. Intersections seem to return "APPROXIMATE", so
						// that is acceptable for geocoding intersections.
						callback(null, {lat: locationGeometry.location.lat, lon: locationGeometry.location.lng});
					} else {
						console.log("Could not accurately geocode address: " + addr);
						callback("Could not accurately geocode address.");
					}
				} else {
					console.log("No geocodings found for address: " + addr);
					callback("No geocodings found.");
				}
			} else {
				console.log("Error geocoding address: " + addr);
				callback("Error geocoding address.");
			}
		});
	}

	/**
	 * Geocodes the given address with no restriction in accuracy of the returned result(s).
	 *
	 * @param {String} addr The full address to geocode, including city, province, and postal code.
	 * @param {function} callback Function to call when geocoding has returned.
	 */
	function _geocodeNoRestrict(addr, callback) {
		googleMapsClient.geocode({address: addr}, function(err, response) {
			if (!err) {
				var results = response.json.results;
				if (results && results.length > 0) {
					var firstResult = results[0];
					var locationGeometry = firstResult.geometry;
					callback(null, {lat: locationGeometry.location.lat, lon: locationGeometry.location.lng});
				} else {
					console.log("No geocodings found for address: " + addr);
					callback("No geocodings found.");
				}
			} else {
				console.log("Error geocoding address: " + addr);
				callback("Error geocoding address.");
			}
		});
	}

	/**
	 * Geocodes the given address, with the restriction that the returned result is an accurate
	 * geocode with no approximation or interpolation.
	 *
	 * @param {String} addr The full address to geocode, including city, province, and postal code.
	 * @param {function} callback The function to call when geocoding has returned.
	 */
	function _geocode(addr, callback) {
		_geocodeLocality(addr, null, callback);
	}

	module.exports = {
		geocode: _geocode,
		geocodeLocality: _geocodeLocality,
		geocodeNoRestrict: _geocodeNoRestrict
	};
})(module);
