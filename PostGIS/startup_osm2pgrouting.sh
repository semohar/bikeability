# docker daemon must be running!

# Pull a PostGIS image with routing tools for Apple Silicon Mac
docker pull --platform linux/arm64 pgrouting/pgrouting:latest

# Run PostgreSQL with PostGIS and pgRouting
docker run -d \
  --name pgrouting-container \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  pgrouting/pgrouting:latest

# Then use osm2pgrouting from another container
# Or exec into the container to run commands