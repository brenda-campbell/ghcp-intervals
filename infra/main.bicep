targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = 'northeurope'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Application name prefix used for all resources')
param appName string = 'fastestfinger'

// --- Static Web App ---
// SWA is managed outside Bicep while its ARM resource provider lock clears.
// The SWA already exists and is deployed via the CI/CD workflow directly.
// To restore: uncomment the module and its outputs below.

// --- Cosmos DB ---
module cosmosDb 'modules/cosmosDb.bicep' = {
  name: 'deploy-cosmosDb'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- SignalR Service ---
module signalR 'modules/signalr.bicep' = {
  name: 'deploy-signalR'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- Outputs ---
@description('Cosmos DB endpoint')
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint

@description('SignalR connection string')
output signalRConnectionString string = signalR.outputs.connectionString
