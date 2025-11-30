#!/bin/bash

# Format: GeoTIFF
# Coordinate system: WGS84 (EPSG:4326)
# Values: Elevation in meters

# Bounding box, fetched from database
SOUTH=38.5223
NORTH=38.7749
WEST=-90.3236
EAST=-90.1653

# OpenTopography API key
API_KEY="27c39cd0ce8d7bfafbb23e5940bbe9a9" 

# Dataset options:
# USGS10m - 1/3 arc-second (10m) - Best quality, may not cover all areas
# USGS30m - 1 arc-second (30m) - Good quality, broader coverage

echo "Downloading 3DEP data from OpenTopography..."

# Try 10m first (best quality)
curl -o st_louis_elevation.tif \
    "https://portal.opentopography.org/API/usgsdem?datasetName=USGS10m&south=${SOUTH}&north=${NORTH}&west=${WEST}&east=${EAST}&outputFormat=GTiff&API_Key=${API_KEY}"

# Check if download worked
if [ -s st_louis_elevation.tif ]; then
    echo "Success! Downloaded 10m resolution data"
    gdalinfo st_louis_elevation.tif | head -20
else
    echo "10m data not available, trying 30m..."
    curl -o st_louis_elevation.tif \
        "https://portal.opentopography.org/API/usgsdem?datasetName=USGS30m&south=${SOUTH}&north=${NORTH}&west=${WEST}&east=${EAST}&outputFormat=GTiff&API_Key=${API_KEY}"
    
    if [ -s st_louis_elevation.tif ]; then
        echo "Success! Downloaded 30m resolution data"
        gdalinfo st_louis_elevation.tif | head -20
    else
        echo "ERROR: Download failed"
        cat st_louis_elevation.tif
        exit 1
    fi
fi

echo "File saved as: st_louis_elevation.tif"