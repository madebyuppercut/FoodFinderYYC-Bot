"use strict";

var Geocoding = require("./geocoding.js");
var fs = require("fs");

var addresses = require("./data/addresses.json");
var fileOutput = "{\n";

var addressList = []; // NOTE(christian): Build a list of addresses with their keys to be used for batched geocoding.
for (let key in addresses) {
	addressList.push({address: addresses[key], key: key});
}

// NOTE(christian): Google's geocoding API has a limit of 50 requests per second, so the test is
// processed in batches of 50 using a timeout timer with a delay long enough to not exceed the usage limit.
var delayTime = 0;
var batchSize = 50;
var batchCount = Math.ceil(addressList.length / batchSize);
var batchesCompleted = 0;
var begin = 0;
var end = Math.min(batchSize, addressList.length);

for (var batch = 0; batch < batchCount; batch++) {
	console.log("geocoding batch " + batch + " [" + begin + "," + end + "]");

	var batchSlice = addressList.slice(begin, end);
	geocodeAddressBatch(batchSlice, delayTime, function() {
		console.log("Batch completed.");
		batchesCompleted++;
		if (batchesCompleted == batchCount) {
			fileOutput = fileOutput.slice(0, fileOutput.length - 2);
			fileOutput += "\n}";
			fs.open("./data/geocodings.json", "w", function(openErr, fd) {
				if (!openErr) {
					fs.write(fd, fileOutput, function(writeErr, written, buffer) {
						if (!writeErr) {
							console.log("Geocoding finished.");
						} else {
							console.log("Error writing to file at '/data/geocodings.json'.");
							console.log(writeErr);
						}
						fs.close(fd);
					});
				} else {
					console.log("Error opening '/data/geocodings.json' for writing.");
					console.log(openErr);
				}
			});
		}
	});

	delayTime += 1500;
	begin += batchSize;
	end = Math.min(begin + batchSize, addressList.length);
}

// ===========================================================================

function geocodeAddressBatch(addressBatch, delay, completion) {
	setTimeout(function(batch) {
		var completed = 0;
		batch.forEach(function(obj) {
			var address = obj.address;
			if (address != null && address != undefined && address != "") {
				Geocoding.geocodeNoRestrict(address, function(err, gc) {
					if (!err) {
						fileOutput += "\t\"" + obj.key + "\": { \"lat\": " + gc.lat + ", \"lon\": " + gc.lon + "},\n";
					} else {
						console.log(obj.key + ": Failed! (" + err + ")");
					}
					completed++;
					if (completed == batch.length) {
						completion();
					}
				});
			} else {
				completed++;
				if (completed == batch.length) {
					completion();
				}
			}
		});
	}, delay, addressBatch);
}
