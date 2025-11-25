# Bicycle Routing System - SQL Query Reference

A comprehensive collection of SQL queries for exploring and analyzing bicycle routing data in PostGIS.

---

## Table of Contents

1. [Basic Network Statistics](#basic-network-statistics)
2. [Exploring Road Types](#exploring-road-types)
3. [Finding Bike Infrastructure](#finding-bike-infrastructure)
4. [Analyzing Specific Roads](#analyzing-specific-roads)
5. [Network Connectivity Analysis](#network-connectivity-analysis)
6. [Geographic/Spatial Queries](#geographicspatial-queries)
7. [Basic Routing](#basic-routing)
8. [Data Quality Checks](#data-quality-checks)
9. [Gap Analysis](#gap-analysis)
10. [Helper Views](#helper-views)
11. [Integration Functions](#integration-functions)
12. [Working with Additional Data Tables](#working-with-additional-data-tables)

---

## Basic Network Statistics

### Count Total Segments and Intersections

```sql
-- Total road segments
SELECT COUNT(*) as total_segments FROM ways;

-- Total intersections
SELECT COUNT(*) as total_intersections FROM ways_vertices_pgr;
```

### Geographic Extent of Network

```sql
-- Get bounding box of your network
SELECT 
    ST_XMin(ST_Extent(the_geom)) as min_lon,
    ST_XMax(ST_Extent(the_geom)) as max_lon,
    ST_YMin(ST_Extent(the_geom)) as min_lat,
    ST_YMax(ST_Extent(the_geom)) as max_lat
FROM ways;
```

### Overall Network Summary

```sql
-- Total length and average segment size
SELECT 
    COUNT(*) as total_segments,
    ROUND((SUM(length_m) / 1000)::numeric, 2) as total_km,
    ROUND(AVG(length_m)::numeric, 2) as avg_segment_length_m
FROM ways;
```

### Breakdown by Bike-Friendliness

```sql
-- Categorize network by how bike-friendly it is
SELECT 
    CASE 
        WHEN c.priority <= 1.5 THEN 'Excellent (Protected/Dedicated)'
        WHEN c.priority <= 2.5 THEN 'Good (Residential/Low Traffic)'
        WHEN c.priority <= 4.0 THEN 'Acceptable (Minor Roads)'
        WHEN c.priority <= 6.0 THEN 'Poor (Major Roads)'
        ELSE 'Avoid (Dangerous)'
    END as bike_quality,
    COUNT(*) as segment_count,
    ROUND((SUM(w.length_m) / 1000)::numeric, 2) as total_km,
    ROUND((100.0 * SUM(w.length_m) / (SELECT SUM(length_m) FROM ways))::numeric, 1) as percent_of_network
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
GROUP BY 
    CASE 
        WHEN c.priority <= 1.5 THEN 'Excellent (Protected/Dedicated)'
        WHEN c.priority <= 2.5 THEN 'Good (Residential/Low Traffic)'
        WHEN c.priority <= 4.0 THEN 'Acceptable (Minor Roads)'
        WHEN c.priority <= 6.0 THEN 'Poor (Major Roads)'
        ELSE 'Avoid (Dangerous)'
    END
ORDER BY 
    MIN(c.priority);
```

---

## Exploring Road Types

### Raw Tag ID Breakdown

```sql
-- See distribution of tag_ids
SELECT tag_id, COUNT(*) as count
FROM ways
GROUP BY tag_id
ORDER BY count DESC;
```

### Detailed Configuration Breakdown

```sql
-- See road types with configuration details
SELECT 
    c.tag_key,
    c.tag_value,
    c.priority,
    COUNT(*) as segment_count,
    ROUND(AVG(w.length_m)::numeric, 2) as avg_length_m
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
GROUP BY c.tag_key, c.tag_value, c.priority
ORDER BY segment_count DESC;
```

---

## Finding Bike Infrastructure

### Most Bike-Friendly Roads

```sql
-- Find roads with lowest priority (best for bikes)
SELECT 
    c.tag_key,
    c.tag_value,
    c.priority,
    COUNT(*) as count
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE c.priority <= 2.0  -- Adjust threshold as needed
GROUP BY c.tag_key, c.tag_value, c.priority
ORDER BY c.priority;
```

### Dedicated Bike Infrastructure

```sql
-- Find cycleways and protected bike lanes
SELECT 
    c.tag_value,
    COUNT(*) as count,
    ROUND((SUM(w.length_m) / 1000)::numeric, 2) as total_km
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE c.tag_key = 'cycleway' 
   OR (c.tag_key = 'highway' AND c.tag_value = 'cycleway')
GROUP BY c.tag_value;
```

---

## Analyzing Specific Roads

### Named Streets

```sql
-- Look at recognizable streets by name
SELECT 
    w.name,
    c.tag_value as road_type,
    c.priority,
    ROUND(w.length_m::numeric, 2) as length_m,
    w.one_way,
    w.maxspeed_forward
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE w.name IS NOT NULL
ORDER BY w.name
LIMIT 20;
```

### Longest Road Segments

```sql
-- Find the longest segments
SELECT 
    name,
    c.tag_value,
    ROUND(length_m::numeric, 2) as length_m
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
ORDER BY length_m DESC
LIMIT 10;
```

### Search for Specific Street

```sql
-- Find all segments of a specific street
SELECT 
    w.gid,
    w.name,
    c.tag_value as road_type,
    c.priority,
    ROUND(w.length_m::numeric, 2) as length_m,
    w.source,
    w.target
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE w.name ILIKE '%broadway%'  -- Case-insensitive search
ORDER BY w.gid;
```

---

## Network Connectivity Analysis

### Busiest Intersections

```sql
-- Find intersections with the most roads
SELECT 
    v.id,
    v.cnt as roads_connected,
    ROUND(ST_Y(v.the_geom)::numeric, 6) as latitude,
    ROUND(ST_X(v.the_geom)::numeric, 6) as longitude
FROM ways_vertices_pgr v
ORDER BY v.cnt DESC
LIMIT 10;
```

### Dead Ends

```sql
-- Count nodes with only one connection
SELECT COUNT(*) as dead_end_count
FROM ways_vertices_pgr
WHERE cnt = 1;
```

### Connectivity Distribution

```sql
-- How connected is the network overall?
SELECT 
    cnt as connections_per_node,
    COUNT(*) as node_count
FROM ways_vertices_pgr
GROUP BY cnt
ORDER BY cnt;
```

---

## Geographic/Spatial Queries

### Find Roads Near a Point

```sql
-- Find roads within 1km of a specific location
-- Example: Gateway Arch at 38.6247° N, 90.1849° W
SELECT 
    w.name,
    c.tag_value,
    ROUND(w.length_m::numeric, 2) as length_m,
    ROUND(ST_Distance(
        w.the_geom::geography,
        ST_SetSRID(ST_MakePoint(-90.1849, 38.6247), 4326)::geography
    )::numeric, 2) as distance_m
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE ST_DWithin(
    w.the_geom::geography,
    ST_SetSRID(ST_MakePoint(-90.1849, 38.6247), 4326)::geography,
    1000  -- 1000 meters = 1km radius
)
AND w.name IS NOT NULL
ORDER BY distance_m
LIMIT 20;
```

### Find Roads in a Bounding Box

```sql
-- Find all roads within a rectangular area
SELECT 
    w.name,
    c.tag_value,
    ROUND(w.length_m::numeric, 2) as length_m
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE ST_Intersects(
    w.the_geom,
    ST_MakeEnvelope(
        -90.20, 38.60,  -- min_lon, min_lat
        -90.18, 38.64,  -- max_lon, max_lat
        4326
    )
)
LIMIT 50;
```

### Calculate Distance Between Two Points

```sql
-- Distance between two coordinates
SELECT ST_Distance(
    ST_SetSRID(ST_MakePoint(-90.1849, 38.6247), 4326)::geography,
    ST_SetSRID(ST_MakePoint(-90.2000, 38.6300), 4326)::geography
) as distance_meters;
```

---

## Basic Routing

### Find Random Connected Nodes

```sql
-- Get two nodes to test routing between
SELECT id, 
       ROUND(ST_Y(the_geom)::numeric, 6) as lat, 
       ROUND(ST_X(the_geom)::numeric, 6) as lon
FROM ways_vertices_pgr
WHERE cnt > 1  -- Ensure they're connected
ORDER BY RANDOM()
LIMIT 2;
```

### Simple Route Between Two Nodes

```sql
-- Calculate shortest path using Dijkstra
-- Replace 123 and 456 with actual node IDs
SELECT * FROM pgr_dijkstra(
    'SELECT gid as id, source, target, length_m as cost FROM ways',
    123,  -- start node
    456,  -- end node
    directed := false
);
```

### Route with Full Road Details

```sql
-- Get route with road names and details
WITH route AS (
    SELECT * FROM pgr_dijkstra(
        'SELECT gid as id, source, target, length_m as cost FROM ways',
        123,  -- start node
        456,  -- end node
        directed := false
    )
)
SELECT 
    r.seq,
    r.node,
    r.edge,
    w.name,
    c.tag_value as road_type,
    ROUND(w.length_m::numeric, 2) as segment_length_m,
    ROUND(r.cost::numeric, 2) as cumulative_cost
FROM route r
LEFT JOIN ways w ON r.edge = w.gid
LEFT JOIN configuration c ON w.tag_id = c.tag_id
ORDER BY r.seq;
```

### Calculate Total Route Distance

```sql
-- Get total distance of a route
WITH route AS (
    SELECT * FROM pgr_dijkstra(
        'SELECT gid as id, source, target, length_m as cost FROM ways',
        123,  -- start node
        456,  -- end node
        directed := false
    )
)
SELECT 
    COUNT(*) as segment_count,
    ROUND((SUM(w.length_m) / 1000)::numeric, 2) as total_distance_km
FROM route r
JOIN ways w ON r.edge = w.gid;
```

### Bike-Optimized Route (Prefer Low-Priority Roads)

```sql
-- Route that prefers bike-friendly roads
SELECT * FROM pgr_dijkstra(
    'SELECT gid as id, source, target, 
            length_m * c.priority as cost  -- Multiply by priority
     FROM ways w
     JOIN configuration c ON w.tag_id = c.tag_id',
    123,  -- start node
    456,  -- end node
    directed := false
);
```

---

## Data Quality Checks

### Roads Without Names

```sql
-- Count unnamed roads by type
SELECT 
    c.tag_value,
    COUNT(*) as unnamed_count
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE w.name IS NULL
GROUP BY c.tag_value
ORDER BY unnamed_count DESC;
```

### Check for Missing Length Values

```sql
-- Find segments with invalid lengths
SELECT COUNT(*) as missing_length
FROM ways
WHERE length_m IS NULL OR length_m = 0;
```

### One-Way Street Distribution

```sql
-- See distribution of one-way streets
SELECT 
    CASE 
        WHEN one_way = 0 THEN 'Two-way'
        WHEN one_way = 1 THEN 'One-way forward'
        WHEN one_way = 2 THEN 'One-way reverse'
        ELSE 'Unknown'
    END as direction,
    COUNT(*) as count
FROM ways
GROUP BY one_way;
```

### Check for Invalid Geometries

```sql
-- Find any invalid geometries
SELECT 
    gid,
    name,
    ST_IsValidReason(the_geom) as reason
FROM ways
WHERE NOT ST_IsValid(the_geom);
```

---

## Gap Analysis

### Coverage Grid Analysis

```sql
-- Create a grid and analyze bike infrastructure coverage
-- This divides your area into ~500m x 500m cells
CREATE TEMP TABLE coverage_grid AS
WITH bounds AS (
    SELECT ST_Extent(the_geom) as geom FROM ways
),
grid AS (
    SELECT 
        ST_MakeEnvelope(
            ST_XMin(geom) + (x * 0.005),
            ST_YMin(geom) + (y * 0.005),
            ST_XMin(geom) + ((x + 1) * 0.005),
            ST_YMin(geom) + ((y + 1) * 0.005),
            4326
        ) as cell_geom,
        x, y
    FROM bounds,
    generate_series(0, FLOOR((ST_XMax(geom) - ST_XMin(geom)) / 0.005)::int) as x,
    generate_series(0, FLOOR((ST_YMax(geom) - ST_YMin(geom)) / 0.005)::int) as y
)
SELECT 
    row_number() OVER () as grid_id,
    cell_geom,
    ROUND(ST_Y(ST_Centroid(cell_geom))::numeric, 6) as center_lat,
    ROUND(ST_X(ST_Centroid(cell_geom))::numeric, 6) as center_lon
FROM grid;

-- Analyze each grid cell
SELECT 
    g.grid_id,
    g.center_lat,
    g.center_lon,
    COUNT(w.gid) FILTER (WHERE c.priority <= 2.5) as bike_friendly_segments,
    COUNT(w.gid) as total_segments,
    ROUND((SUM(w.length_m) FILTER (WHERE c.priority <= 2.5) / 1000)::numeric, 2) as bike_friendly_km,
    ROUND((SUM(w.length_m) / 1000)::numeric, 2) as total_km
FROM coverage_grid g
LEFT JOIN ways w ON ST_Intersects(g.cell_geom, w.the_geom)
LEFT JOIN configuration c ON w.tag_id = c.tag_id
GROUP BY g.grid_id, g.center_lat, g.center_lon
HAVING COUNT(w.gid) > 0
ORDER BY bike_friendly_segments ASC, total_segments DESC
LIMIT 20;
```

### Major Roads Without Bike Infrastructure

```sql
-- Find busy roads lacking bike lanes
SELECT 
    w.name,
    c.tag_value as road_type,
    c.priority,
    ROUND((w.length_m / 1000)::numeric, 2) as length_km,
    w.maxspeed_forward,
    ROUND(ST_Y(ST_StartPoint(w.the_geom))::numeric, 6) as start_lat,
    ROUND(ST_X(ST_StartPoint(w.the_geom))::numeric, 6) as start_lon
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE c.tag_key = 'highway'
  AND c.tag_value IN ('primary', 'secondary', 'tertiary')
  AND c.priority > 3.0
  AND w.name IS NOT NULL
ORDER BY w.length_m DESC
LIMIT 30;
```

### Disconnected Bike Networks

```sql
-- Find bike infrastructure that's isolated
WITH bike_segments AS (
    SELECT w.gid, w.source, w.target, w.the_geom, w.name
    FROM ways w
    JOIN configuration c ON w.tag_id = c.tag_id
    WHERE c.priority <= 2.0
)
SELECT 
    v.id as node_id,
    v.cnt as connections,
    ROUND(ST_Y(v.the_geom)::numeric, 6) as lat,
    ROUND(ST_X(v.the_geom)::numeric, 6) as lon,
    COUNT(bs.gid) as bike_segments_at_node
FROM ways_vertices_pgr v
LEFT JOIN bike_segments bs ON v.id IN (bs.source, bs.target)
WHERE v.cnt <= 2
GROUP BY v.id, v.cnt, v.the_geom
HAVING COUNT(bs.gid) > 0
ORDER BY v.cnt, COUNT(bs.gid) DESC
LIMIT 20;
```

### Bike-Friendliness by Area

```sql
-- Score different areas by bike infrastructure quality
WITH area_grid AS (
    SELECT 
        ST_MakeEnvelope(
            ST_XMin(extent) + (x * 0.02),
            ST_YMin(extent) + (y * 0.02),
            ST_XMin(extent) + ((x + 1) * 0.02),
            ST_YMin(extent) + ((y + 1) * 0.02),
            4326
        ) as area_geom,
        x, y
    FROM (SELECT ST_Extent(the_geom) as extent FROM ways) bounds,
    generate_series(0, 20) as x,
    generate_series(0, 20) as y
)
SELECT 
    ROUND(ST_Y(ST_Centroid(ag.area_geom))::numeric, 6) as center_lat,
    ROUND(ST_X(ST_Centroid(ag.area_geom))::numeric, 6) as center_lon,
    COUNT(w.gid) as total_segments,
    ROUND((100.0 * COUNT(w.gid) FILTER (WHERE c.priority <= 2.5) / 
          NULLIF(COUNT(w.gid), 0))::numeric, 1) as pct_bike_friendly,
    ROUND((SUM(w.length_m) / 1000)::numeric, 2) as total_km,
    ROUND((SUM(w.length_m) FILTER (WHERE c.priority <= 2.5) / 1000)::numeric, 2) as bike_friendly_km
FROM area_grid ag
JOIN ways w ON ST_Intersects(ag.area_geom, w.the_geom)
JOIN configuration c ON w.tag_id = c.tag_id
GROUP BY ag.area_geom
HAVING COUNT(w.gid) > 10
ORDER BY pct_bike_friendly DESC
LIMIT 20;
```

---

## Helper Views

### Create Bike-Friendly Roads View

```sql
-- View for easy access to bike-friendly roads
CREATE VIEW bike_friendly_roads AS
SELECT 
    w.gid,
    w.name,
    c.tag_value as road_type,
    c.priority,
    w.length_m,
    w.source,
    w.target,
    w.the_geom
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE c.priority <= 2.5;

-- Use it
SELECT COUNT(*) FROM bike_friendly_roads;
SELECT * FROM bike_friendly_roads WHERE name ILIKE '%main%';
```

### Create Dangerous Roads View

```sql
-- View for roads to avoid
CREATE VIEW dangerous_roads AS
SELECT 
    w.gid,
    w.name,
    c.tag_value as road_type,
    c.priority,
    w.length_m,
    w.maxspeed_forward,
    w.the_geom
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
WHERE c.priority >= 6.0;
```

---

## Integration Functions

### Find Nearest Road Segment to a Point

```sql
-- Function to find the closest road segment to any point
CREATE OR REPLACE FUNCTION find_nearest_segment(point_geom GEOMETRY)
RETURNS TABLE(segment_id BIGINT, distance_m FLOAT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.gid,
        ST_Distance(point_geom::geography, w.the_geom::geography) as dist
    FROM ways w
    ORDER BY w.the_geom <-> point_geom
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Use it
SELECT * FROM find_nearest_segment(
    ST_SetSRID(ST_MakePoint(-90.1849, 38.6247), 4326)
);
```

### Calculate Safety Score for a Segment

```sql
-- Function to calculate safety based on nearby accidents
CREATE OR REPLACE FUNCTION calculate_segment_safety_score(
    seg_id BIGINT, 
    radius_m FLOAT DEFAULT 100
)
RETURNS FLOAT AS $$
DECLARE
    accident_count INTEGER;
    severe_count INTEGER;
    safety_score FLOAT;
BEGIN
    -- Count accidents near this segment
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE severity IN ('severe', 'fatal'))
    INTO accident_count, severe_count
    FROM accidents a
    JOIN ways w ON w.gid = seg_id
    WHERE ST_DWithin(a.location::geography, w.the_geom::geography, radius_m);
    
    -- Calculate score (0-100, higher is safer)
    safety_score := 100 - (accident_count * 5) - (severe_count * 20);
    
    RETURN GREATEST(0, LEAST(100, safety_score));
END;
$$ LANGUAGE plpgsql;

-- Use it (after you have accident data)
SELECT 
    gid,
    name,
    calculate_segment_safety_score(gid, 100) as safety_score
FROM ways
WHERE name IS NOT NULL
ORDER BY safety_score
LIMIT 20;
```

---

## Working with Additional Data Tables

### Find Accidents Near a Specific Road

```sql
-- After populating the accidents table
SELECT 
    a.accident_id,
    a.severity,
    a.accident_date,
    w.name as nearest_road,
    ROUND(ST_Distance(a.location::geography, w.the_geom::geography)::numeric, 2) as distance_m
FROM accidents a
CROSS JOIN LATERAL (
    SELECT gid, name, the_geom
    FROM ways
    ORDER BY the_geom <-> a.location
    LIMIT 1
) w
WHERE a.accident_date > NOW() - INTERVAL '1 year'
ORDER BY a.accident_date DESC
LIMIT 20;
```

### Find POIs Near a Route

```sql
-- Find bike shops within 500m of a route
WITH route AS (
    SELECT ST_Union(w.the_geom) as route_geom
    FROM pgr_dijkstra(
        'SELECT gid as id, source, target, length_m as cost FROM ways',
        123, 456, false
    ) r
    JOIN ways w ON r.edge = w.gid
)
SELECT 
    p.name,
    p.poi_type,
    ROUND(ST_Distance(p.location::geography, r.route_geom::geography)::numeric, 2) as distance_m
FROM pois p, route r
WHERE ST_DWithin(p.location::geography, r.route_geom::geography, 500)
AND p.poi_type IN ('bike_shop', 'bike_parking')
ORDER BY distance_m;
```

### Check Weather Conditions Along Route

```sql
-- Get weather near a route (requires weather_observations table)
WITH route AS (
    SELECT ST_Union(w.the_geom) as route_geom
    FROM pgr_dijkstra(
        'SELECT gid as id, source, target, length_m as cost FROM ways',
        123, 456, false
    ) r
    JOIN ways w ON r.edge = w.gid
)
SELECT 
    ws.station_name,
    wo.condition,
    wo.temperature_c,
    wo.precipitation_mm,
    wo.observation_time
FROM route r
CROSS JOIN weather_stations ws
JOIN weather_observations wo ON ws.station_id = wo.station_id
WHERE ST_DWithin(ws.location::geography, r.route_geom::geography, 5000)
AND wo.observation_time > NOW() - INTERVAL '1 hour'
ORDER BY wo.observation_time DESC
LIMIT 5;
```

### Identify High-Accident Road Segments

```sql
-- Find road segments with multiple accidents nearby
SELECT 
    w.gid,
    w.name,
    c.tag_value as road_type,
    COUNT(a.accident_id) as accident_count,
    COUNT(a.accident_id) FILTER (WHERE a.severity IN ('severe', 'fatal')) as severe_count,
    ROUND((w.length_m / 1000)::numeric, 2) as length_km
FROM ways w
JOIN configuration c ON w.tag_id = c.tag_id
LEFT JOIN accidents a ON ST_DWithin(
    w.the_geom::geography, 
    a.location::geography, 
    50  -- 50 meter buffer
)
WHERE a.accident_date > NOW() - INTERVAL '2 years'
GROUP BY w.gid, w.name, c.tag_value, w.length_m
HAVING COUNT(a.accident_id) >= 3
ORDER BY accident_count DESC, severe_count DESC
LIMIT 30;
```

### Avoid Problem Areas in Routing

```sql
-- Route that avoids active problem areas
SELECT * FROM pgr_dijkstra(
    'SELECT w.gid as id, w.source, w.target,
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM problem_areas pa
                    WHERE ST_DWithin(w.the_geom::geography, pa.location::geography, 100)
                    AND pa.status = ''active''
                ) THEN w.length_m * 10  -- High penalty for problem areas
                ELSE w.length_m * c.priority
            END as cost
     FROM ways w
     JOIN configuration c ON w.tag_id = c.tag_id',
    123,  -- start node
    456,  -- end node
    directed := false
);
```

---

## Tips and Best Practices

### Type Casting for ROUND()

PostgreSQL requires casting to `numeric` before rounding:

```sql
-- Won't work
ROUND(my_float_column, 2)

-- Works
ROUND(my_float_column::numeric, 2)
```

### Using ST_DWithin for Performance

When searching within a radius, use `ST_DWithin` instead of `ST_Distance`:

```sql
-- Slower (calculates distance for all rows)
SELECT * FROM ways 
WHERE ST_Distance(the_geom::geography, point::geography) < 1000;

-- Faster (uses spatial index)
SELECT * FROM ways 
WHERE ST_DWithin(the_geom::geography, point::geography, 1000);
```

### Geography vs Geometry

- Use `::geography` for accurate distance calculations in meters
- Use `::geometry` for faster spatial operations when accuracy isn't critical

```sql
-- Accurate distance in meters
ST_Distance(geom1::geography, geom2::geography)

-- Faster but in degrees
ST_Distance(geom1, geom2)
```

### Examining Query Plans

To optimize slow queries:

```sql
EXPLAIN ANALYZE
SELECT ... your query here ...;
```

Look for sequential scans that should be using indexes.

---

## Common Troubleshooting

### "No function matches" Error

Cast your types explicitly:

```sql
-- Add ::numeric, ::integer, ::text as needed
ROUND(value::numeric, 2)
```

### Slow Spatial Queries

Ensure you have spatial indexes:

```sql
-- Check existing indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE tablename = 'ways';

-- Create spatial index if missing
CREATE INDEX idx_ways_geom ON ways USING GIST(the_geom);
```

### Empty Results from Routing

Check that your nodes are actually connected:

```sql
-- Verify node exists and is connected
SELECT * FROM ways_vertices_pgr WHERE id = 123;

-- See what edges connect to this node
SELECT * FROM ways WHERE source = 123 OR target = 123;
```

---

## Additional Resources

- **pgRouting Documentation**: https://docs.pgrouting.org/
- **PostGIS Documentation**: https://postgis.net/documentation/
- **OpenStreetMap Wiki**: https://wiki.openstreetmap.org/wiki/Bicycle
- **OSM Tag Reference**: https://taginfo.openstreetmap.org/
