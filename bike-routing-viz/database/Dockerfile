FROM pgrouting/pgrouting:latest

# Assume image and data have already been downloaded and are saved externally

# Install additional tools needed for import
RUN apt-get update && apt-get install -y \
    osmium-tool \
    osm2pgrouting \
    gdal-bin \
    wget \
    postgis \
    && rm -rf /var/lib/apt/lists/*

# Copy only the extension setup script
COPY ./init-scripts/01-create-extensions.sql /docker-entrypoint-initdb.d/
