# Stage 1: Build frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Production runtime
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server
COPY public ./public

# Create certificates directory
RUN mkdir -p /certs

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start server
CMD ["node", "server/index.js"]

