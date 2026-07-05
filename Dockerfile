# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building frontend)
RUN npm install

# Copy application files
COPY . .

# Build the project (React frontend via Vite and Node server bundling via esbuild)
RUN npm run build

# Production image stage
FROM node:20-alpine

WORKDIR /app

# Copy package files to run production scripts
COPY --from=builder /app/package*.json ./

# Install ONLY production dependencies to keep the image minimal
RUN npm install --omit=dev

# Copy built dist files
COPY --from=builder /app/dist ./dist
# Copy public directory for static assets
COPY --from=builder /app/public ./public

# Set production environment
ENV NODE_ENV=production
ENV PORT=5174

# Expose port
EXPOSE 5174

# Start the application
CMD ["npm", "run", "start"]
