#!/bin/bash
set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}=========================================="
echo -e "WARNING: This will delete ALL data!"
echo -e "==========================================${NC}"
echo ""
echo "This will remove:"
echo "  - OSM routing data (ways, vertices)"
echo "  - Elevation data (rasters, vertex/segment tables)"
echo "  - Crash incident data"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${YELLOW}Cleaning up all data tables...${NC}"

docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    -- Drop OSM tables
    DROP TABLE IF EXISTS ways CASCADE;
    DROP TABLE IF EXISTS ways_vertices_pgr CASCADE;
    DROP TABLE IF EXISTS pointsofinterest CASCADE;
    DROP TABLE IF EXISTS configuration CASCADE;
    
    -- Drop elevation tables
    DROP TABLE IF EXISTS elevation CASCADE;
    DROP TABLE IF EXISTS vertex_elevation CASCADE;
    DROP TABLE IF EXISTS segment_elevation CASCADE;
    
    -- Drop crash tables
    DROP TABLE IF EXISTS crash_incidents CASCADE;
EOSQL

echo -e "${GREEN}✓ All data cleaned up${NC}"
echo ""
echo "You can now run ./scripts/import_all.sh to reimport everything."