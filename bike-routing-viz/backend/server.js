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
    password: process.env.DB_PASSWORD || '',
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
        // Different cost functions for different route types
        const costFormula = type === 'safest' 
            ? `w.length_m * c.priority * 
               (1 + COALESCE(
                   CASE WHEN se.grade_percent > 0 THEN se.grade_percent * 0.3 ELSE 0 END, 
                   0
               ))`
            : 'w.length_m';
        
        const result = await pool.query(`
            WITH route AS (
                SELECT * FROM pgr_dijkstra(
                    'SELECT 
                        w.gid as id, 
                        w.source, 
                        w.target,
                        ${costFormula} as cost
                     FROM ways w
                     JOIN configuration c ON w.tag_id = c.tag_id
                     LEFT JOIN segment_elevation se ON w.gid = se.segment_id',
                    $1, $2, false
                )
            )
            SELECT 
                json_build_object(
                    'type', 'FeatureCollection',
                    'features', json_agg(
                        json_build_object(
                            'type', 'Feature',
                            'geometry', ST_AsGeoJSON(w.the_geom)::json,
                            'properties', json_build_object(
                                'name', w.name,
                                'length_m', ROUND(w.length_m::numeric, 2),
                                'grade_percent', ROUND(COALESCE(se.grade_percent, 0)::numeric, 2),
                                'elevation_change_m', ROUND(COALESCE(se.elevation_change_m, 0)::numeric, 2),
                                'road_type', c.tag_value,
                                'seq', r.seq
                            )
                        )
                    )
                ) as geojson
            FROM route r
            JOIN ways w ON r.edge = w.gid
            JOIN configuration c ON w.tag_id = c.tag_id
            LEFT JOIN segment_elevation se ON w.gid = se.segment_id
            WHERE r.edge IS NOT NULL;
        `, [start, end]);
        
        if (result.rows[0] && result.rows[0].geojson) {
            res.json(result.rows[0].geojson);
        } else {
            res.status(404).json({ error: 'No route found' });
        }
    } catch (error) {
        console.error('Error calculating route:', error);
        res.status(500).json({ error: 'Failed to calculate route' });
    }
});

// Get elevation profile for a route
app.get('/api/elevation-profile', async (req, res) => {
    const { start, end } = req.query;
    
    if (!start || !end) {
        return res.status(400).json({ error: 'Missing start or end node' });
    }
    
    try {
        const result = await pool.query(`
            WITH route AS (
                SELECT * FROM pgr_dijkstra(
                    'SELECT gid as id, source, target, length_m as cost FROM ways',
                    $1, $2, false
                )
            )
            SELECT 
                r.seq,
                w.name,
                se.elevation_start_m,
                se.elevation_end_m,
                se.grade_percent,
                w.length_m,
                SUM(w.length_m) OVER (ORDER BY r.seq) as cumulative_distance_m
            FROM route r
            JOIN ways w ON r.edge = w.gid
            LEFT JOIN segment_elevation se ON w.gid = se.segment_id
            WHERE r.edge IS NOT NULL
            ORDER BY r.seq;
        `, [start, end]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching elevation profile:', error);
        res.status(500).json({ error: 'Failed to fetch elevation profile' });
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