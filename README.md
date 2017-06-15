# Food Finder YYC Bot

## Dependencies

1. NodeJS
2. npm

## Installation and Start Up Server

1. Check out this repository
2. Set `NODE_ENV` environment variable to `local` (`export NODE_ENV=local`)
3. Run `npm install`
4. Run `node index.js`
5. Tests are executed by running the `run_test` shell script with a given data object or JSON file containing user input to test. The output will consist of the conversation flow between the user and the Food Finder bot.
	e.g. `./run_test.sh -local "[\"FOOD\", \"today\", ...]"`

## Generating required data for the Bot

The user has three options for telling the Bot what their current location is. The first two involve inputting an address, whereas the third
option allows them to input the name of a municipal place such as a school or library. Geocodes for these places are stored in a flat map that
is looked up into based on their input. Data for these places is stored online in a Google spreadsheet, and the "generate_places_data.js" script
is used to read the spreadsheet and convert the data into the JSON files expected by the Bot's server.

To run:

`node generate_places_data.js`

(The first time this script is run locally on a machine, authorization will be required in order to connect with the Google sheets API. Follow
the instructions in the console output to complete the auth process.)

Since places can have a number of aliases/nicknames, two files are generated in order to efficiently store the many-to-one relationship:
"places.json" that maps a place's name (and potentially a number of aliases) to a code, and "addresses.json" that maps the corresponding code
from "places.json" to its address. To generate the geocodes for the adddresses, run

`node geocode_addresses.js`

This will create the "geocodings.json" file from the "addresses.json" file with a similar format, except it maps to a place's geocode instead of
its address.
