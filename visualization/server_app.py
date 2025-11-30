from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import json

app = Flask(__name__)
CORS(app)  # Allow browser requests

# Database connection
def get_db():
    return psycopg2.connect(
        host="localhost",
        database="bike_routing",
        user="postgres",
        password="password",
        port=5432
    )

@app.route('/api/route', methods=['GET'])
def get_route():
    """Calculate route between two nodes"""
    start_node = request.args.get('start', type=int)
    end_node = request.args.get('end', type=int)
    route_type = request.args.get('type', 'fastest')  # 'fastest' or 'safest'
    
    if not start_node or not end_node:
        return jsonify({'error': 'Missing start or end node'}), 400
    
    # Different cost functions for different route types
    if route_type == 'safest':
        cost_formula = '''
            w.length_m * c.priority * 
            (1 + COALESCE(
                CASE WHEN se.grade_percent > 0 THEN se.grade_percent * 0.3 ELSE 0 END, 
                0
            ))
        '''
    else:  # fastest
        cost_formula = 'w.length_m'
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    # Get route with details
    query = f"""
        WITH route AS (
            SELECT * FROM pgr_dijkstra(
                'SELECT 
                    w.gid as id, 
                    w.source, 
                    w.target,
                    {cost_formula} as cost
                 FROM ways w
                 JOIN configuration c ON w.tag_id = c.tag_id
                 LEFT JOIN segment_elevation se ON w.gid = se.segment_id',
                {start_node}, {end_node}, false
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
    """
    
    cur.execute(query)
    result = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if result and result['geojson']:
        return jsonify(result['geojson'])
    else:
        return jsonify({'error': 'No route found'}), 404

@app.route('/api/nodes/random', methods=['GET'])
def get_random_nodes():
    """Get two random connected nodes for testing"""
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    query = """
        SELECT 
            id,
            ST_Y(the_geom) as lat,
            ST_X(the_geom) as lon
        FROM ways_vertices_pgr
        WHERE cnt >= 3
        ORDER BY RANDOM()
        LIMIT 2;
    """
    
    cur.execute(query)
    nodes = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(nodes)

@app.route('/api/elevation-profile', methods=['GET'])
def get_elevation_profile():
    """Get elevation profile for a route"""
    start_node = request.args.get('start', type=int)
    end_node = request.args.get('end', type=int)
    
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    query = f"""
        WITH route AS (
            SELECT * FROM pgr_dijkstra(
                'SELECT gid as id, source, target, length_m as cost FROM ways',
                {start_node}, {end_node}, false
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
    """
    
    cur.execute(query)
    profile = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(profile)

if __name__ == '__main__':
    app.run(debug=True, port=5001)