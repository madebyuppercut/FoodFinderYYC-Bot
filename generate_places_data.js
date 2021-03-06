"use strict";

var fs = require("fs");
var readline = require("readline");
var google = require("googleapis");
var googleAuth = require("google-auth-library");
var googleLocal = require("./local/google.json");

var tokenDir = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + "/.credentials/";
var tokenPath = tokenDir + googleLocal.tokenFile;

fs.readFile("./local/google_client_secret.json", function(err, content) {
  if (err) {
    console.log("Error loading client secret file: " + err);
    return;
  }
  authorize(JSON.parse(content), generatePlacesData);
});

// ===========================================================================

function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  fs.readFile(tokenPath, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  });

  console.log("Authorize this app by visiting this url: ", authUrl);
  var r1 = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  r1.question("Enter the code from that page here: ", function(code) {
    r1.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log("Error while trying to retrieve access token: ", err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

function storeToken(token) {
  try {
    fs.mkdirSync(tokenDir);
  } catch (err) {
    if (err.code != "EEXIST") {
      throw err;
    }
  }
  fs.writeFile(tokenPath, JSON.stringify(token));
  console.log("Token stored to " + tokenPath);
}

/**
 * Generates the data files required by the Food Finder Bot to support places
 * input by the user. e.g. The user can let the Bot know what their current
 * location is by texting a school that is close by, or some other municipal
 * location.
 *
 * The spreadsheetId parameter passed to the sheets API can be found in the
 * URL when viewing the spreadsheet in a browser. The range format is
 * [spreadsheet_name]![[col_start][row_start]:[col_end]]
 */
function generatePlacesData(auth) {
  var sheets = google.sheets("v4");
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: googleLocal.spreadsheetId,
    range: "Sheet1!D2:I"
  }, function(err, response) {
    if (err) {
      console.log("The API returned an error: " + err);
      return;
    }
    console.log("Generating places data from spreadsheet...");

    var rows = response.values;

    var placesString = "{\n";
    var addressesString = "{\n";

    for (var i = 0; i < rows.length; i++) {
      // NOTE(christian): Since the spreadsheet was loaded starting at column D,
      // it corresponds to column index 0. i.e. D = 0, E = 1, etc.
      var row = rows[i];
      var placeEntry = row[0].trim().toLowerCase();
      placesString += "\t\"" + placeEntry + "\": \"" + i + "\",\n";
      addressesString += "\t\"" + i + "\": " + "\"" + row[1].trim() + "\",\n";

      var aliasesStr = row[5];
      if (aliasesStr != null && aliasesStr != undefined && aliasesStr != "") {
        var aliases = aliasesStr.split(",");
        for (var j = 0; j < aliases.length; j++) {
          var aliasEntry = aliases[j].trim().toLowerCase();
          placesString += "\t\"" + aliasEntry + "\": \"" + i + "\",\n";
        }
      }
    }

    writeStringToFile(placesString, "places.json");
    writeStringToFile(addressesString, "addresses.json");
  });
}

function writeStringToFile(str, filename) {
  str = str.slice(0, str.length - 2);
  str += "\n}";

  var path = "./data/" + filename;
  fs.open(path, "w", function(openErr, fd) {
    if (!openErr) {
      fs.write(fd, str, function(writeErr, written, buffer) {
        if (!writeErr) {
          console.log("Generated data file at " + path);
        } else {
          console.log("Error writing to file at " + path);
          console.log(writeErr);
        }
        fs.close(fd);
      });
    } else {
      console.log("Error opening file at path " + path + " for writing.");
      console.log(openErr);
    }
  });
}
