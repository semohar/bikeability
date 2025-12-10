const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS
app.use(cors());
app.use(express.json());

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'bike_routing',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Get random nodes for testing
app.get('/api/nodes/random', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                id,
                ST_Y(the_geom) as lat,
                ST_X(the_geom) as lon
            FROM ways_vertices_pgr
            WHERE cnt >= 3
            ORDER BY RANDOM()
            LIMIT 2;
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching random nodes:', error);
        res.status(500).json({ error: 'Failed to fetch nodes' });
    }
});

// Calculate route between two nodes
app.get('/api/route', async (req, res) => {
    const { start, end, type = 'fastest' } = req.query;
    
    if (!start || !end) {
        return res.status(400).json({ error: 'Missing start or end node' });
    }
    
    try {
        const startNode = parseInt(start, 10);
        const endNode = parseInt(end, 10);
        
        if (isNaN(startNode) || isNaN(endNode)) {
            return res.status(400).json({ error: 'Start and end must be valid integers' });
        }
        
        console.log(`Route request: start=${startNode}, end=${endNode}, type=${type}`);
        
        const costFormula = type === 'safest' 
            ? '(w.length_m * c.priority * (1 + COALESCE(CASE WHEN se.grade_percent > 0 THEN se.grade_percent * 0.3 ELSE 0 END, 0)))'
            : 'w.length_m';
        
        const result = await pool.query(`
            WITH route AS (
                SELECT * FROM pgr_dijkstra(
                    'SELECT 
                        w.gid as id, 
                        w.source as source, 
                        w.target as target,
                        ${costFormula}::float8 as cost
                     FROM ways w
                     JOIN configuration c ON w.tag_id = c.tag_id
                     LEFT JOIN segment_elevation se ON w.gid = se.segment_id',
                    ${startNode}::bigint,
                    ${endNode}::bigint,
                    false
                )
            )
            SELECT 
                json_build_object(
                    'type', 'FeatureCollection',
                    'features', COALESCE(
                        json_agg(
                            json_build_object(
                                'type', 'Feature',
                                'geometry', ST_AsGeoJSON(w.the_geom)::json,
                                'properties', json_build_object(
                                    'name', COALESCE(w.name, 'Unnamed'),
                                    'length_m', ROUND(w.length_m::numeric, 2),
                                    'grade_percent', ROUND(COALESCE(se.grade_percent, 0)::numeric, 2),
                                    'elevation_change_m', ROUND(COALESCE(se.elevation_change_m, 0)::numeric, 2),
                                    'road_type', COALESCE(c.tag_value, 'unknown'),
                                    'seq', r.seq
                                )
                            )
                        ) FILTER (WHERE r.edge IS NOT NULL AND w.the_geom IS NOT NULL),
                        '[]'::json
                    )
                ) as geojson
            FROM route r
            LEFT JOIN ways w ON r.edge = w.gid
            LEFT JOIN configuration c ON w.tag_id = c.tag_id
            LEFT JOIN segment_elevation se ON w.gid = se.segment_id
            WHERE r.edge IS NOT NULL AND w.gid IS NOT NULL;
        `);
        
        if (result.rows[0] && result.rows[0].geojson && result.rows[0].geojson.features && result.rows[0].geojson.features.length > 0) {
            console.log(`✓ Route found with ${result.rows[0].geojson.features.length} segments`);
            res.json(result.rows[0].geojson);
        } else {
            console.log('✗ No route found');
            res.status(404).json({ error: 'No route found' });
        }
    } catch (error) {
        console.error('Error calculating route:', error.message);
        res.status(500).json({ error: 'Failed to calculate route', details: error.message });
    }
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log(`🚴 Bike routing API listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    pool.end(() => {
        console.log('Database pool closed');
    });
});