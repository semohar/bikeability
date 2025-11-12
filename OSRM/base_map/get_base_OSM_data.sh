#!/bin/bash

MISSOURI_MAP_PATH="missouri-latest.osm.pbf"

if [ -f "$MISSOURI_MAP_PATH" ]; then
    echo "$MISSOURI_MAP_PATH exists. Skipping download..."
else
    echo "$MISSOURI_MAP_PATH does not exist. Downloading..."
    # Download St. Louis area
    wget https://download.geofabrik.de/north-america/us/missouri-latest.osm.pbf
fi

# Use osmium to extract just St. Louis City County
# Coordinates represent the bounding box that will be extracted
osmium extract -p saint_louis_city_county.geojson missouri-latest.osm.pbf -o saint-louis-city-county.osm.pbf