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

# Remove default Nginx config and templates dir to prevent auto-processing
RUN rm /etc/nginx/conf.d/default.conf && rm -rf /etc/nginx/templates

# Copy template to a custom location (NOT /etc/nginx/templates/ to avoid
# the nginx image's built-in envsubst which corrupts nginx $ variables)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy custom entrypoint that uses sed to safely substitute API_FQDN
COPY docker-entrypoint-wrapper.sh /docker-entrypoint-wrapper.sh
RUN chmod +x /docker-entrypoint-wrapper.sh

# Copy built frontend assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint-wrapper.sh"]
