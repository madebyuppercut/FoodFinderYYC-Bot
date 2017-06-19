# Food Finder YYC Bot

## Dependencies

1. NodeJS
2. npm

## Installation and Start Up Server

1. Check out this repository
2. Create a `.env` file in the project's root directory that contains the necessary keys & settings for running the Bot. (See example below).
3. Set `NODE_ENV` environment variable to `local` (`export NODE_ENV=local`)
4. Run `npm install`
5. Run `npm start`
6. Tests are executed by running the `run_test` shell script with a given data object or JSON file containing user input to test. The output will consist of the conversation flow between the user and the Food Finder bot.
	e.g. `./run_test.sh -local "[\"FOOD\", \"today\", ...]"` For the test script to output the correct conversation, both the Bot server and the Parse server (containing the location data to query) need to be running locally.

## Generating required data for the Bot

The user has three options for telling the Bot what their current location is. The first two involve inputting an address, whereas the third
option allows them to input the name of a public or Catholic school. Geocodes for these places are stored in a flat map that
is looked up into based on their input. Data for these places is stored online in a Google spreadsheet, and the *generate_places_data.js* script
is used to read the spreadsheet and convert the data into the JSON files expected by the Bot's server. (In order for this script to work, a Google client secret JSON file and a JSON file with the spreadsheet ID and Google API key are required to be present in _local_. For further info, see the Google documentation on using their sheets API.)

To run:

`node generate_places_data.js`

(The first time this script is run locally on a machine, authorization will be required in order to connect with the Google sheets API. Follow
the instructions in the console output to complete the auth process.)

Since places can have a number of aliases/nicknames, two files are generated in order to efficiently store the many-to-one relationship:
*places.json* that maps a place's name (and potentially a number of aliases) to a code, and *addresses.json* that maps the corresponding code
from *places.json* to its address. To generate the geocodes for the adddresses, run

`node geocode_addresses.js`

This will create the *geocodings.json* file from the *addresses.json* file with a similar format, except it maps to a place's geocode instead of
its address.

After generating the data, it can be validated by running the *validate_data.js* script. The requirements for valid data are:

- All place (school) names (including aliases) must be unique.
- The codes/keys in *addresses.json* and *geocodings.json* must be unique.
- A **warning** is issued if a place code does not exist in either *addresses.json* or *geocodings.json*. In other words, if a place name does not map to any address or geocode.

## Sample .env

```
{
  "port": 8090,
  "parse": {
    "appID": "XXXXX",
    "javascriptKey": "XXXXX",
    "serverURL": "http://localhost:8080/parse/"
  },
  "twilio": {
    "accountSID": "XXXXX",
    "authToken": "XXXXX",
    "phoneNumber": "+15005550006"
  },
  "google": {
    "apiKey": "XXXXX",
    "spreadsheetID": "XXXXX"
  }
}
```

Note that the `port` above is the local port for the *Bot* server and must be different from the Parse server used for querying location data. The `foreman` node package will concatenate the above JSON entries with underscores and force them to uppercase. e.g. The Parse server url is accessed as `process.env.PARSE_SERVERURL`.
