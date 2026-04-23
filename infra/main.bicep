targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = 'northeurope'

@description('Azure region for Static Web App (must be a supported SWA region)')
param swaLocation string = 'westeurope'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Application name prefix used for all resources')
param appName string = 'fastestfinger'

// --- Static Web App ---
// SWA is managed outside Bicep while its ARM resource provider lock clears.
// The SWA already exists and is deployed via the CI/CD workflow directly.
// To restore: uncomment the module and its outputs below.

// --- Networking (VNet + Subnets) ---
module networking 'modules/networking.bicep' = {
  name: 'deploy-networking'
  params: {
    location: swaLocation  // VNet must be in SWA region for VNet integration
    environmentName: environmentName
    appName: appName
  }
}

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
// Note: PE name is constructed deterministically to avoid circular dependency
// (SignalR needs PE name for networkACLs, PEs need SignalR resource ID)
var signalRPrivateEndpointName = '${appName}-${environmentName}-signalr-pe'

module signalR 'modules/signalr.bicep' = {
  name: 'deploy-signalR'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    privateEndpointName: signalRPrivateEndpointName
  }
}

// --- Private Endpoints (Cosmos DB + SignalR) ---
module privateEndpoints 'modules/privateEndpoints.bicep' = {
  name: 'deploy-privateEndpoints'
  params: {
    location: swaLocation  // PEs in same region as VNet
    environmentName: environmentName
    appName: appName
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    vnetId: networking.outputs.vnetId
    cosmosDbAccountId: cosmosDb.outputs.resourceId
    signalRId: signalR.outputs.resourceId
  }
}

// --- Outputs ---
@description('Cosmos DB endpoint')
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint

@description('SignalR connection string')
output signalRConnectionString string = signalR.outputs.connectionString
