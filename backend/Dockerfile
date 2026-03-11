# ─────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed to compile TypeScript)
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2: Production image
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

# Set Node to production mode (disables dev-only behaviour, reduces memory)
ENV NODE_ENV=production

WORKDIR /app

# Copy only the production dependency manifest
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Run as a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# NestJS default port
EXPOSE 3000

# Start the compiled app
CMD ["node", "dist/main"]
