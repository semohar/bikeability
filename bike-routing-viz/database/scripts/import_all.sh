#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Starting complete data import process"
echo "=========================================="

echo ${SCRIPT_DIR}

# Step 1: OSM and routing setup
echo -e "${BLUE}[1/4] Setting up OSM and routing data...${NC}"
bash "$SCRIPT_DIR/01_setup_osm.sh"

# Step 2: Elevation data
echo -e "${BLUE}[2/4] Setting up elevation data...${NC}"
bash "$SCRIPT_DIR/02_setup_elevation.sh"

# Step 3: Geocode crash data
echo -e "${BLUE}[3/4] Geocoding crash data...${NC}"
python3 "$SCRIPT_DIR/03_geocode_crashes.py"

# Step 4: Import crashes to database
echo -e "${BLUE}[4/4] Importing crash data to database...${NC}"
python3 "$SCRIPT_DIR/04_import_crashes.py"

# Step 5: Link crashes to segments
echo -e "${BLUE}[5/5] Linking crashes to road segments...${NC}"
bash "$SCRIPT_DIR/05_link_crashes.sh"

echo ""
echo -e "${GREEN}=========================================="
echo -e "✓ COMPLETE DATA IMPORT FINISHED!"
echo -e "==========================================${NC}"
echo ""
echo "Database: localhost:5432"
echo ""