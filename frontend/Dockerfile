# ─────────────────────────────────────────────
# Stage 1: Build the React app
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

RUN npm ci

# Copy source code
COPY . .

# Produce a static build in /app/dist (or /app/build for CRA)
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Serve static files with NGINX
# ─────────────────────────────────────────────
FROM nginx:1.25-alpine AS production

# Remove default NGINX welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Minimal NGINX config: serve SPA with fallback to index.html for client-side routing
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
