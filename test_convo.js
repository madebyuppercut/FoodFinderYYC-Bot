"use strict";

var Console = require("console").Console;
var fs = require("fs");

function* _nextUserResponse(userInput) {
	var i = 0;
	while (i < userInput.length) {
		yield userInput[i];
		i++;
	}
}

function _logNextUserResponse(co, userInput, logger) {
	var nextResponse = co.next(userInput);
	if (!nextResponse.done) {
		logger.log("USER: " + nextResponse.value);
		return {text: nextResponse.value};
	}

	return null;
}

function TestConvo(userInput, logFile) {
	this.userInput = userInput;
	this.nextConvo = false;
	this.userResponse = _nextUserResponse(this.userInput);
	this.responses = {};

	var loggerOutput = fs.createWriteStream("./tests/" + logFile);
	this.logger = new Console(loggerOutput);
}

TestConvo.prototype.say = function(text) {
	this.logger.log("BOT: " + text);
}

TestConvo.prototype.ask = function(text, callback, opt) {
	this.say(text);
	this.nextConvo = false;
	var response = _logNextUserResponse(this.userResponse, this.userInput, this.logger);
	if (response) {
		if (opt) {
			var key = opt.key;
			this.responses[key] = response.text;
		}
		callback(response, this);
	} else {
		this.logger.log("* 'ask' called with no user response *");
		this.next();
	}

	while (!this.nextConvo) {
		response = _logNextUserResponse(this.userResponse, this.userInput, this.logger);
		if (!response) {
			break;
		}
		callback(response, this);
	}
}

TestConvo.prototype.extractResponse = function(key) {
	return this.responses[key];
}

TestConvo.prototype.next = function() {
	this.nextConvo = true;
}

TestConvo.prototype.setTimeout = function() {
	// No op
}

TestConvo.prototype.onTimeout = function() {
	// No op
}


module.exports = TestConvo;
