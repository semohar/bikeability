A personal data integration and routing project to ingest and transform publically available data (traffic levels, road conditions, weather, accident history, etc) to generate an optimal biking path and serve the result via web application.

Database: PostGIS
Backend: Node.js + Express
Frontend: React

To run:

```
docker-compose up -d --build
```

To quit:

```
docker-compose down -v
```

Local: http://localhost:5173

# Project Progress Log

### 11.7.25

#### Work
- Developed project concept
  - General heuristic
- Generated list of potential data sources
- Finished first pass at response shape in .yaml form
- Made repo
- Began to consider base route requirements/design

#### To Do
- Later: Articulate how response shape will be used
  - Could be specific (i.e. with some UI mapping tool that can read GeoJson with metadata)
  - Could be general (pseudo-algo for using details)
- Map data sources to response shape
  - Consider T needed
- General architecture design

---

### 11.8.25

#### Work
- Refined route engine requirements for mapping
- Collected some bike-specific data sources

#### To Do
- Review and revise proposed architecture; articulate
- Map data sources to sources + methods of injection
  - Consider data that should be cached

---

### 11.10.25

#### Work
- Extracted STLCC map from Missouri OSM data using osmium
- Decided to use OSRM with MLD arch (i.e. Lua profiles) with a dynamic runtime layer (i.e. weights)

---

### 11.21.25

#### Work
- Switched to osm2pgrouting approach to get experience using PostGIS + PostgreSQL
- Set up image with necessary files
- Converted .osm.pbf to .osm for osm2pgrouting

#### To Do
- oms2pgrouting doesn't seem to pull in much - need to fix mapconfig.xml for existing tags?

---

### 11.24.25

#### Work
- Created custom mapconfig.xml file that works with stlcc.osm
- Created PostgreSQL database with stlcc.osm data
- Started construction custom heuristic

#### To Do
- NOTE: mapconfig.xml file affects heuristic; what if a user wanted to avoid certain roadways? --> probably can set in route query

---

### 11.27.25

#### Work
- Got elevation data from USGS National Elevation Dataset (NED) / 3DEP
- Imported raster into PostGIS using raster2pgsql
- Design decision: (re: elevation table) while keeping everything in one table results in faster query times, the same data will be stored multiple places + the system will have many data sources

---

### 11.30.25

#### Work
- Spun up a simple web framework for serving routes using Mapbox GL JS
- Created backend server using Flask and Python (via venv)
- Created basic frontend webpage using HTML

#### To Do
- Consider using Node.js for service (Scala/Python/Rust for data processing?)
- Create customize heuristic(s) to include in server
- Create a Dockerfile to formally save custom image + database setup
- Consider production architecture

---

### 12.2.25

#### Work
- Created Dockerfile with dependencies (made tightly coupled to STL data for now)
  - Flow: docker-compose, then /import-data.sh (need database to restart first - see notes)
- Debugged accidental async `docker exec` calls in `import-data.sh` (sol: -i)
- Debugged bad pgr_dijkstra call (sol: cast req to ints; were being parsed as strings)

#### To Do
- (LP) Should eventually build arm64 psgrouting image (consider workflow for regular updates)
- Consider moving FE over to React for a full-stack product
- Next: LiDAR, or tweak routing algo?

---

### 12.10.25

#### Work
- Decided on using modular design with serperated BE + FE (rather than using something like Next.js for fullstack). Better for future potential "serverless" design, and good for learning

#### To Do
