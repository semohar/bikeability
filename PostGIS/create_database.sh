#!/bin/bash
# Full import with cnt calculation

echo "Dropping and recreating database..."
dropdb -U postgres bike_routing
createdb -U postgres bike_routing

echo "Enabling extensions..."
psql -U postgres -d bike_routing -c "CREATE EXTENSION postgis;"
psql -U postgres -d bike_routing -c "CREATE EXTENSION pgrouting;"

echo "Importing OSM data..."
osm2pgrouting \
  --f /tmp/saint-louis-city-county.osm \
  --conf /usr/share/osm2pgrouting/mapconfig_for_bicycles.xml \
  --dbname bike_routing \
  --username postgres \
  --password mysecretpassword \
  --clean

echo "Creating indexes..."
psql -U postgres -d bike_routing -c "
CREATE INDEX IF NOT EXISTS idx_ways_source ON ways(source);
CREATE INDEX IF NOT EXISTS idx_ways_target ON ways(target);
CREATE INDEX IF NOT EXISTS idx_vertices_cnt ON ways_vertices_pgr(cnt);
"

echo "Calculating vertex connectivity (cnt)..."
psql -U postgres -d bike_routing -c "
UPDATE ways_vertices_pgr v
SET cnt = (
    SELECT COUNT(*)
    FROM ways w
    WHERE w.source = v.id OR w.target = v.id
);
"

echo "Import complete!"
echo "Verifying..."
psql -U postgres -d bike_routing -c "
SELECT 
    COUNT(*) as total_nodes,
    COUNT(*) FILTER (WHERE cnt IS NOT NULL) as nodes_with_cnt,
    MIN(cnt) as min_connections,
    MAX(cnt) as max_connections,
    ROUND(AVG(cnt)::numeric, 2) as avg_connections
FROM ways_vertices_pgr;
"