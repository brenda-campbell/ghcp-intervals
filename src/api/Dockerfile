# =============================================================================
# Fastest Finger Quiz — API (Azure Functions Node.js 20)
# =============================================================================
# Build:  docker build -t fastestfinger-api .
# Run:    docker run -p 80:80 --env-file .env fastestfinger-api
# =============================================================================

FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies (production only)
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy TypeScript source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm ci && npx tsc

# ---

FROM mcr.microsoft.com/azure-functions/node:4-node20

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

WORKDIR /home/site/wwwroot

# Copy host.json (Functions runtime config)
COPY host.json ./

# Copy compiled output
COPY --from=build /app/dist/ ./dist/

# Copy question data files (referenced at runtime)
COPY src/data/ ./src/data/

# Copy production node_modules
COPY --from=build /app/node_modules/ ./node_modules/

# Copy package.json (Functions runtime reads it)
COPY package.json ./

EXPOSE 80
