# docker daemon must be running!

# Pull a PostGIS image with routing tools for Apple Silicon Mac
docker pull --platform linux/arm64 pgrouting/pgrouting:latest

# Run PostgreSQL with PostGIS and pgRouting
docker run -d \
  --name pgrouting-container \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  pgrouting/pgrouting:latest

# Copy .osm.pbf and .mapconfig.json files to container - eventually bake this into the image
docker cp /Users/shelby/Repos/bikeability/OSM/base_map/saint-louis-city-county.osm pgrouting-container:/tmp/saint-louis-city-county.osm

docker cp /Users/shelby/Repos/bikeability/PostGIS/mapconfig_bike.xml pgrouting-container:/tmp/mapconfig_bike.xml

# Then use osm2pgrouting from another container
# Or exec into the container to run commands