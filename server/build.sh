#!/bin/sh
# Packs the function for upload: always takes the game rules from docs/core.js so client and server never drift apart.
set -e
cd "$(dirname "$0")"
cp ../docs/core.js core.js
rm -f srulque-server.zip
zip -q srulque-server.zip index.js core.js package.json
echo "built $(pwd)/srulque-server.zip"
