var TwilioBot = require("botkit-sms");
var FFYYCBot = require("./ffyyc_bot.js");

var port = process.env.PORT || 8090;

var controller = TwilioBot({
	account_sid: process.env.TWILIO_ACCOUNTSID,
	auth_token: process.env.TWILIO_AUTHTOKEN,
	twilio_number: process.env.TWILIO_PHONENUMBER
});
//
let bot = controller.spawn({});

controller.setupWebserver(port, function(err, webserver) {
	controller.createWebhookEndpoints(controller.webserver, bot, function() {
		console.log("Bot is online.");
	});
});

controller.hears(FFYYCBot.hears, "message_received", function(bot, message) {
	console.log("[HEARD]: " + message);
	bot.startConversation(message, function(error, convo) {
		FFYYCBot.startConversation(convo);
	});
});


// ==========================================================================
//	 Server routes
// ==========================================================================
var app = controller.webserver;

/**
 * Post GET to this route to retrieve current statistics on the Bot and interactions with it.
 * On completion, this route returns a JSON object of the gathered statistics.
 */
app.get("/stats", function(req, res) {
	var FFYYCStats = require("./ffyyc_stats.js");
	var stats = FFYYCStats.getStats(function(results, error) {
		if (results != null && results != undefined) {
			res.send(results);
		} else {
			var errorMessage = error.length + " error(s):\n";
			for (var err of error) {
				errorMessage += err.message;
				errorMessage += "\n";
			}
			res.send(errorMessage);
		}
	});
});

/**
 * Send a POST request to this endpoint to test a conversation. The request body should be a JSON
 * object of the form:
 * {"convo": [...], "testFile": "..."}
 * where the "convo" value is an array of user responses to each step in the converation flow,
 * and the "testFile" value is the name of the output file to record the conversation.
 */
app.post("/test_convo", function(req, res) {
	var data = req.body;
	var TestConvo = require("./test_convo.js");
	var testConvo = new TestConvo(data.convo, data.testFile);
	FFYYCBot.startConversation(testConvo);

	res.send("Test finished.\n");
});
