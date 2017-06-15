#!/bin/bash

## Run Food Finder Bot conversation test ##
#
# Usage:
#	run_test [-local|-dev|-prod] params
#	run_test [-local|-dev|-prod] -file file
#
# where 'params' is a JSON object containing the user's input for each step of the 
# conversation as key-value pairs. The list of possible keys are:
#	greeting, city, address, location
#
# 	e.g. run_test -local "{\"greeting\":\"Hello\", \"city\":\"Calgary\", ...}"
#
# and 'file' is a JSON file in the same format as 'params'.
#
#	e.g. run_test -dev -file test0.json
#

if [ "$1" != "" ]; then
	case $1 in
		-local)
		POST_URL="http://localhost:8090/test_convo"
		;;
		-dev)
		POST_URL="https://food-finder-bot-dev.heroku.com/test_convo"
		;;
		-prod)
		POST_URL="https://food-finder-bot.heroku.com/test_convo"
		;;
		*)
		;;
	esac
fi

if [ "$2" != "" ]; then
	if [ "$2" == "-file" ]; then
		PARAMS=`cat $3`
	else
		PARAMS="$2"
	fi
fi

if [ "$POST_URL" != "" ] && [ "$PARAMS" != "" ]; then
	echo "Running conversation test..."
	echo
	
	TIMESTAMP=$(date +%Y-%m-%d-%H:%M:%S)
	TEST_FILENAME="test_result_$TIMESTAMP.txt"
	PARAMS="{\"convo\": $PARAMS, \"testFile\": \"$TEST_FILENAME\"}"
	
	curl -X POST -H "Content-Type: application/json" -d "${PARAMS}" $POST_URL
	#open -e "./tests/$TEST_FILENAME"
else
	echo "Missing parameters..."
	echo
	echo "Usage:"
	echo "run_test [-local|-dev|-prod] params"
	echo "run_test [-local|-dev|-prod] -file file"
	echo
fi