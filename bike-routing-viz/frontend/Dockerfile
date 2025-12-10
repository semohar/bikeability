# =============================================================================
# PRODUCTION DOCKERFILE - Multi-stage build for optimized static files
# =============================================================================
# Purpose: Creates a small, optimized image for production deployment
# Result: ~20MB final image with static files served by Nginx
# Usage: docker build -f Dockerfile -t bike-routing-frontend .
# =============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Builder - Compiles and optimizes the React application
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (for Docker layer caching)
# If package.json doesn't change, this layer is cached and npm ci is skipped
COPY package*.json ./

# Install dependencies
# npm ci: Clean install from package-lock.json (faster, deterministic)
# Only installs production dependencies in final bundle
RUN npm ci

# Copy all source code
# Done after npm ci so code changes don't invalidate dependency cache
COPY . .

# Build the application for production
# Creates optimized, minified static files in /app/dist
# Includes tree-shaking, code splitting, asset optimization
RUN npm run build

# -----------------------------------------------------------------------------
# STAGE 2: Production - Lightweight Nginx server for static files
# -----------------------------------------------------------------------------
FROM nginx:alpine

# Copy built static files from builder stage
# /app/dist (from builder) → /usr/share/nginx/html (Nginx's default root)
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
# Configures routing (SPA support), API proxying, headers, etc.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for HTTP traffic
EXPOSE 80

# Start Nginx in foreground mode
# "daemon off" keeps Nginx running as PID 1 (required for Docker)
CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Why multi-stage build?
# -----------------------------------------------------------------------------
# 1. Builder stage includes all build tools (~500MB)
# 2. Production stage only includes Nginx + static files (~20MB)
# 3. Result: 96% smaller final image, faster deployments, lower costs
# 
# Build process:
#   Source code → npm run build → dist/ → Nginx → Browser
# 
# What gets included in final image:
#   ✅ Built HTML/CSS/JS files from dist/
#   ✅ Nginx web server
#   ❌ Node.js (not needed for serving static files)
#   ❌ Source code from src/
#   ❌ node_modules/ (not needed after build)
#   ❌ Build tools (Vite, TypeScript, etc.)
# -----------------------------------------------------------------------------