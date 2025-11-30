-- Add a custom cost column
ALTER TABLE ways ADD COLUMN bike_cost FLOAT;

-- Calculate it once with your custom formula
UPDATE ways w
SET bike_cost = w.length_m * c.priority * 
                (1 + COALESCE(v1.cnt, 2) * 0.05) *
                (1 + COALESCE(v2.cnt, 2) * 0.05)
FROM configuration c
LEFT JOIN ways_vertices_pgr v1 ON w.source = v1.id
LEFT JOIN ways_vertices_pgr v2 ON w.target = v2.id
WHERE w.tag_id = c.tag_id;

-- Create index
CREATE INDEX idx_ways_bike_cost ON ways(bike_cost);

-- Now routing is simple and fast
SELECT * FROM pgr_dijkstra(
    'SELECT gid as id, source, target, bike_cost as cost FROM ways',
    start_node,
    end_node,
    false
);