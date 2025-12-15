#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Clean up existing elevation data
echo -e "${YELLOW}Cleaning up existing elevation tables...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    DROP TABLE IF EXISTS elevation CASCADE;
    DROP TABLE IF EXISTS vertex_elevation CASCADE;
    DROP TABLE IF EXISTS segment_elevation CASCADE;
EOSQL
echo -e "${GREEN}✓ Cleanup complete${NC}"

echo -e "${YELLOW}Copying elevation data into container...${NC}"
docker cp data/st_louis_elevation.tif bike-routing-db:/tmp/
echo -e "${GREEN}✓ File copied${NC}"

echo -e "${YELLOW}Importing elevation raster (this takes 2-5 minutes)...${NC}"
docker exec bike-routing-db bash -c "
    raster2pgsql -s 4326 -I -C -M -t 100x100 /tmp/st_louis_elevation.tif elevation | psql -U postgres -d bike_routing > /dev/null
"
echo -e "${GREEN}✓ Elevation raster imported${NC}"

echo -e "${YELLOW}Creating elevation tables...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    -- Create vertex_elevation table
    CREATE TABLE IF NOT EXISTS vertex_elevation (
        elevation_id SERIAL PRIMARY KEY,
        vertex_id BIGINT NOT NULL REFERENCES ways_vertices_pgr(id) ON DELETE CASCADE,
        elevation_m FLOAT NOT NULL,
        source_name VARCHAR(100) NOT NULL,
        source_resolution_m INTEGER,
        import_date TIMESTAMP DEFAULT NOW(),
        UNIQUE(vertex_id, source_name)
    );
    
    CREATE INDEX IF NOT EXISTS idx_vertex_elevation_vertex ON vertex_elevation(vertex_id);
    CREATE INDEX IF NOT EXISTS idx_vertex_elevation_source ON vertex_elevation(source_name);
    
    -- Create segment_elevation table
    CREATE TABLE IF NOT EXISTS segment_elevation (
        segment_id BIGINT PRIMARY KEY REFERENCES ways(gid) ON DELETE CASCADE,
        elevation_start_m FLOAT,
        elevation_end_m FLOAT,
        elevation_change_m FLOAT,
        grade_percent FLOAT,
        source_name VARCHAR(100),
        calculated_at TIMESTAMP DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_segment_elevation_id ON segment_elevation(segment_id);
    CREATE INDEX IF NOT EXISTS idx_segment_elevation_source ON segment_elevation(source_name);
EOSQL

echo -e "${GREEN}✓ Tables created${NC}"

echo -e "${YELLOW}Populating vertex elevation (this takes 2-3 minutes)...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    INSERT INTO vertex_elevation (vertex_id, elevation_m, source_name, source_resolution_m)
    SELECT 
        v.id,
        ST_Value(e.rast, v.the_geom) as elevation_m,
        'USGS_3DEP_10m',
        10
    FROM ways_vertices_pgr v
    CROSS JOIN elevation e
    WHERE ST_Intersects(e.rast, v.the_geom)
      AND ST_Value(e.rast, v.the_geom) IS NOT NULL;
EOSQL

echo -e "${GREEN}✓ Vertex elevations populated${NC}"

echo -e "${YELLOW}Calculating segment grades (this takes 2-3 minutes)...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    INSERT INTO segment_elevation (
        segment_id,
        elevation_start_m,
        elevation_end_m,
        elevation_change_m,
        grade_percent,
        source_name
    )
    SELECT 
        w.gid,
        ve_start.elevation_m,
        ve_end.elevation_m,
        ve_end.elevation_m - ve_start.elevation_m,
        CASE 
            WHEN w.length_m > 0 THEN 
                ((ve_end.elevation_m - ve_start.elevation_m) / w.length_m) * 100
            ELSE 0
        END,
        'USGS_3DEP_10m'
    FROM ways w
    JOIN vertex_elevation ve_start ON w.source = ve_start.vertex_id
    JOIN vertex_elevation ve_end ON w.target = ve_end.vertex_id;
EOSQL

echo -e "${GREEN}✓ Segment grades calculated${NC}"

echo -e "${YELLOW}Gathering elevation statistics...${NC}"
docker exec -i bike-routing-db psql -U postgres -d bike_routing <<-EOSQL
    SELECT 
        'Vertices with elevation: ' || COUNT(*) as stat
    FROM vertex_elevation
    UNION ALL
    SELECT 
        'Segments with grade: ' || COUNT(*)
    FROM segment_elevation
    UNION ALL
    SELECT 
        'Min elevation: ' || ROUND(MIN(elevation_m)::numeric, 2) || 'm'
    FROM vertex_elevation
    UNION ALL
    SELECT 
        'Max elevation: ' || ROUND(MAX(elevation_m)::numeric, 2) || 'm'
    FROM vertex_elevation
    UNION ALL
    SELECT 
        'Steepest uphill: ' || ROUND(MAX(grade_percent)::numeric, 2) || '%'
    FROM segment_elevation
    UNION ALL
    SELECT 
        'Steepest downhill: ' || ROUND(MIN(grade_percent)::numeric, 2) || '%'
    FROM segment_elevation;
EOSQL

echo -e "${GREEN}✓ Elevation setup complete${NC}"