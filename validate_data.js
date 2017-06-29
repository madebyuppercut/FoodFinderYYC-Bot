"use strict";

var places = require("./data/places.json");
var addresses = require("./data/addresses.json");
var geocodings = require("./data/geocodings.json");

// Tests
var placesNames = testUniqueKeys("Places", places);
var addressesCodes = testUniqueKeys("Addresses", addresses);
var geocodingsCodes = testUniqueKeys("Geocodings", geocodings);

testPlacesHaveAddressesAndGeocodes(placesNames, addressesCodes, geocodingsCodes);

// ============================================================================

function testUniqueKeys(name, obj) {
  var keys = new Set();
  var passed = true;
  Object.keys(obj).forEach(function(key) {
    if (!keys.has(key)) {
      keys.add(key);
    } else {
      console.log("FAILED(" + name + "): Duplicate key - " + key);
      passed = false;
    }
  });

  if (passed) {
    console.log("PASSED(" + name + "): All keys are unique.");
  }

  return keys;
}

function testPlacesHaveAddressesAndGeocodes(placesNames, addressesCodes, geocodingsCodes) {
  var placesCodes = [];
  placesNames.forEach(function(placeName) {
    placesCodes.push(places[placeName]);
  });

  var passed = true;
  placesCodes.forEach(function(placeCode) {
    if (!addressesCodes.has(placeCode)) {
      console.log("WARNING: Place code " + placeCode + " is not found in addresses.");
      passed = false;
    }
    if (!geocodingsCodes.has(placeCode)) {
      console.log("WARNING: Place code " + placeCode + " is not found in geocodings.");
      passed = false;
    }
  });

  if (passed) {
    console.log("PASSED: All places have corresponding entries in addresses and geocodings.");
  }
}
