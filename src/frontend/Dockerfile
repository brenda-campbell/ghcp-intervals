# =============================================================================
# Fastest Finger Quiz — Frontend (React + Nginx)
# =============================================================================
# Build:  docker build -t fastestfinger-frontend .
# Run:    docker run -p 80:80 -e API_FQDN=api fastestfinger-frontend
# =============================================================================

# --- Stage 1: Build React app ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Stage 2: Serve with Nginx ---
FROM nginx:alpine

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy Nginx template (envsubst processes ${API_FQDN} at container start)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built frontend assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
