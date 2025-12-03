-- Create necessary PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS pgrouting;

-- Verify extensions
SELECT extname, extversion FROM pg_extension WHERE extname IN ('postgis', 'postgis_raster', 'pgrouting');