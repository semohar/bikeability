#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
until docker exec bike-routing-db pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 2
done
echo -e "${GREEN}✓ PostgreSQL is ready!${NC}"

# Clean up existing OSM data
echo -e "${YELLOW}Cleaning up existing OSM tables...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    DROP TABLE IF EXISTS ways CASCADE;
    DROP TABLE IF EXISTS ways_vertices_pgr CASCADE;
    DROP TABLE IF EXISTS pointsofinterest CASCADE;
    DROP TABLE IF EXISTS configuration CASCADE;
EOSQL
echo -e "${GREEN}✓ Cleanup complete${NC}"

echo -e "${YELLOW}Copying OSM data files into container...${NC}"
docker cp data/saint-louis-city-county.osm bike-routing-db:/tmp/
docker cp data/mapconfig_bicycle.xml bike-routing-db:/tmp/
echo -e "${GREEN}✓ Files copied${NC}"

echo -e "${YELLOW}Running osm2pgrouting (this takes 2-5 minutes)...${NC}"
docker exec bike-routing-db osm2pgrouting \
  --f /tmp/saint-louis-city-county.osm \
  --conf /tmp/mapconfig_bicycle.xml \
  --dbname bike_routing \
  --username postgres \
  --host localhost \
  --clean

echo -e "${GREEN}✓ OSM data imported${NC}"

echo -e "${YELLOW}Indexing ways(source) and ways(target)...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    CREATE INDEX IF NOT EXISTS idx_ways_source ON ways(source);
    CREATE INDEX IF NOT EXISTS idx_ways_target ON ways(target);
EOSQL

echo -e "${GREEN}✓ Indexing complete${NC}"

echo -e "${YELLOW}Calculating vertex connectivity...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    UPDATE ways_vertices_pgr v
    SET cnt = (
        SELECT COUNT(*)
        FROM ways w
        WHERE w.source = v.id OR w.target = v.id
    );
EOSQL

echo -e "${GREEN}✓ Connectivity calculated${NC}"

echo -e "${YELLOW}Indexing ways_vertices_pgr(cnt)...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    CREATE INDEX IF NOT EXISTS idx_vertices_cnt ON ways_vertices_pgr(cnt);
EOSQL

echo -e "${GREEN}✓ Indexing complete${NC}"
echo -e "${GREEN}✓ OSM setup complete${NC}"