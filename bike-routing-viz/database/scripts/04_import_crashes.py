#!/usr/bin/env python3
"""
Import geocoded crash data into PostgreSQL database
"""
import os
import sys
import pandas as pd
import subprocess

INPUT_FILE = '../data/crash_data_geocoded.csv'
DB_CONTAINER = 'bike-routing-db'
DB_NAME = 'bike_routing'
DB_USER = 'postgres'

def create_crash_table():
    """Create crash_incidents table if it doesn't exist"""
    print("Cleaning up existing crash data...")
    
    # Terminate active connections and drop with CASCADE
    cleanup_sql = """
    -- Terminate any active queries on the table
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = 'bike_routing'
      AND pid <> pg_backend_pid()
      AND query LIKE '%crash_incidents%';
    
    -- Drop the table with CASCADE to handle dependencies
    DROP TABLE IF EXISTS crash_incidents CASCADE;
    """
    
    cmd = [
        'docker', 'exec', '-i', DB_CONTAINER,
        'psql', '-U', DB_USER, '-d', DB_NAME
    ]
    
    try:
        result = subprocess.run(cmd, input=cleanup_sql.encode(), capture_output=True, timeout=10)
        if result.returncode != 0:
            print(f"Warning during cleanup: {result.stderr.decode()}")
    except subprocess.TimeoutExpired:
        print("Cleanup timed out, forcing...")
        # Force kill any hanging connections
        force_cmd = [
            'docker', 'exec', '-i', DB_CONTAINER,
            'psql', '-U', DB_USER, '-d', DB_NAME, '-c',
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'bike_routing' AND pid <> pg_backend_pid();"
        ]
        subprocess.run(force_cmd, timeout=5)
    
    print("Creating crash_incidents table...")
    
    create_sql = """
    CREATE TABLE crash_incidents (
        id SERIAL PRIMARY KEY,
        weekday VARCHAR(10),
        incident_date DATE,
        incident_time TIME,
        severity VARCHAR(50),
        at_street VARCHAR(200),
        on_street VARCHAR(200),
        light_cond VARCHAR(50),
        injured INTEGER,
        killed INTEGER,
        location GEOMETRY(Point, 4326),
        geocode_confidence VARCHAR(20),
        geocoded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX idx_crash_location ON crash_incidents USING GIST(location);
    CREATE INDEX idx_crash_date ON crash_incidents(incident_date);
    CREATE INDEX idx_crash_severity ON crash_incidents(severity);
    """
    
    subprocess.run(cmd, input=create_sql.encode(), check=True)
    print("✓ Table created")

def import_crashes():
    """Import crash data from CSV"""
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file not found: {INPUT_FILE}")
        sys.exit(1)
    
    print(f"Loading geocoded data from {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)
    
    geocoded_df = df[df['latitude'].notna() & df['longitude'].notna()].copy()
    
    print(f"Found {len(geocoded_df)} geocoded records out of {len(df)} total")
    
    if len(geocoded_df) == 0:
        print("No geocoded records to insert!")
        return
    
    print("\nConfidence breakdown:")
    print(geocoded_df['geocode_confidence'].value_counts())
    
    # Generate SQL insert statements
    print("\nGenerating SQL inserts...")
    inserts = []
    
    for _, row in geocoded_df.iterrows():
        # Helper function to format values
        def fmt_str(val):
            if pd.isna(val):
                return 'NULL'
            # Escape single quotes by doubling them
            return f"'{str(val).replace("'", "''")}'"
        
        def fmt_int(val):
            if pd.isna(val):
                return '0'
            return str(int(val))
        
        values = [
            fmt_str(row.get('Weekday')),
            fmt_str(row.get('Date')),
            fmt_str(row.get('Time')),
            fmt_str(row.get('Severity')),
            fmt_str(row.get('At Street')),
            fmt_str(row.get('On Street')),
            fmt_str(row.get('Light Cond')),
            fmt_int(row.get('Injured')),
            fmt_int(row.get('Killed')),
            f"ST_SetSRID(ST_MakePoint({row['longitude']}, {row['latitude']}), 4326)",
            fmt_str(row.get('geocode_confidence'))
        ]
        
        insert = f"INSERT INTO crash_incidents (weekday, incident_date, incident_time, severity, at_street, on_street, light_cond, injured, killed, location, geocode_confidence) VALUES ({', '.join(values)});"
        inserts.append(insert)
    
    # Import in batches to avoid command length issues
    sql_content = '\n'.join(inserts)
    
    print(f"Importing {len(inserts)} records...")
    
    cmd = [
        'docker', 'exec', '-i', DB_CONTAINER,
        'psql', '-U', DB_USER, '-d', DB_NAME
    ]
    
    result = subprocess.run(cmd, input=sql_content.encode(), capture_output=True)
    
    if result.returncode != 0:
        print(f"\nErrors occurred during import:")
        print(result.stderr)
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"✓ Successfully imported {len(inserts)} crash records")
    print(f"{'='*60}")

def main():
    create_crash_table()
    import_crashes()

if __name__ == "__main__":
    main()