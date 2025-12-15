#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Linking crashes to road segments...${NC}"

# First, force terminate ALL connections to the database (except ours)
echo -e "${YELLOW}Terminating active connections...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'bike_routing'
      AND pid <> pg_backend_pid();
EOSQL

# Give it a moment
sleep 1

# Now drop and recreate
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    DROP TABLE IF EXISTS crash_segment_proximity CASCADE;
    
    CREATE TABLE crash_segment_proximity (
        id SERIAL PRIMARY KEY,
        crash_id INTEGER REFERENCES crash_incidents(id),
        segment_id BIGINT REFERENCES ways(gid),
        distance_m FLOAT,
        UNIQUE(crash_id, segment_id)
    );

    CREATE INDEX idx_crash_segment_crash ON crash_segment_proximity(crash_id);
    CREATE INDEX idx_crash_segment_segment ON crash_segment_proximity(segment_id);
EOSQL

echo -e "${GREEN}✓ Table created${NC}"
echo -e "${YELLOW}Populating crash-segment links (this may take 2-5 minutes)...${NC}"

# Use a more efficient query that leverages spatial indexes
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    -- Ensure spatial index exists on ways
    CREATE INDEX IF NOT EXISTS idx_ways_geom ON ways USING GIST(the_geom);
    
    -- Use a lateral join for efficiency instead of CROSS JOIN
    INSERT INTO crash_segment_proximity (crash_id, segment_id, distance_m)
    SELECT 
        c.id,
        w.gid,
        ST_Distance(c.location::geography, w.the_geom::geography) as distance_m
    FROM crash_incidents c
    CROSS JOIN LATERAL (
        SELECT w.gid, w.the_geom
        FROM ways w
        WHERE ST_DWithin(c.location, w.the_geom, 0.0005)  -- ~50m in degrees
        ORDER BY c.location <-> w.the_geom
        LIMIT 5  -- Max 5 closest segments per crash
    ) w
    WHERE ST_Distance(c.location::geography, w.the_geom::geography) <= 50
    ON CONFLICT (crash_id, segment_id) DO NOTHING;
EOSQL

echo -e "${GREEN}✓ Crash linking complete${NC}"

# Show statistics
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    SELECT 
        'Total crashes: ' || COUNT(DISTINCT crash_id) as stat
    FROM crash_segment_proximity
    UNION ALL
    SELECT 
        'Total segments with crashes: ' || COUNT(DISTINCT segment_id)
    FROM crash_segment_proximity
    UNION ALL
    SELECT 
        'Total crash-segment links: ' || COUNT(*)
    FROM crash_segment_proximity;
EOSQL