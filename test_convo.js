/**
 * This module is used in conjunction with the 'run_test.sh' Bash script to test
 * conversations with the bot. Executing the Bash script with conversation data
 * posts a request to the 'test_convo' route, which will start a conversation with
 * the bot object using an instance of the 'TestConvo' class in this module as the
 * mock conversation object.
 *
 * The 'TestConvo' class in this module has the same interface as the conversation
 * object in Botkit, but instead of posting requests to the SMS endpoint, it logs
 * output to a text file.
 */

"use strict";

var Console = require("console").Console;
var fs = require("fs");

TestConvo.PHONE_NUMBER = "+15550005555";


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

function _recordResponse(responseText, responses, opt) {
	if (opt) {
		var key = opt.key;
		responses[key] = responseText;
	}
}

function TestConvo(userInput, logFile) {
	this.userInput = userInput;
	this.nextConvo = false;
	this.userResponse = _nextUserResponse(this.userInput);
	this.responses = {};
	this.source_message = {};
	this.source_message.user = TestConvo.PHONE_NUMBER;

	var loggerOutput = fs.createWriteStream("./tests/" + logFile);
	this.logger = new Console(loggerOutput);
}

/**
 * Outputs the bot's response to the logger.
 */
TestConvo.prototype.say = function(text) {
	this.logger.log("BOT: " + text);
}

/**
 * Outputs the bot's question to the logger and reads the next user response
 * from the conversation data that is being tested and outputs it to the logger.
 * In order to simulate waiting on server response before continuing with the
 * conversation, the callback passed to this method can return a value of 'true'.
 */
TestConvo.prototype.ask = function(text, callback, opt) {
	this.say(text);
	this.nextConvo = false;
	var response = _logNextUserResponse(this.userResponse, this.userInput, this.logger);
	if (response) {
		_recordResponse(response.text, this.responses, opt);
		var wait = callback(response, this);
		wait = (wait == undefined ? false : wait);
	} else {
		this.logger.log("* 'ask' called with no user response *");
		this.next();
	}

	while (!this.nextConvo && !wait) {
		response = _logNextUserResponse(this.userResponse, this.userInput, this.logger);
		if (!response) {
			break;
		}
		_recordResponse(response.text, this.responses, opt);
		var wait = callback(response, this);
		wait = (wait == undefined ? false : wait);
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
