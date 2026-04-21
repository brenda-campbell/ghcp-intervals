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
module staticWebApp 'modules/staticWebApp.bicep' = {
  name: 'deploy-staticWebApp'
  params: {
    location: swaLocation
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
module signalR 'modules/signalr.bicep' = {
  name: 'deploy-signalR'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- Outputs ---
@description('Static Web App default hostname')
output staticWebAppHostname string = staticWebApp.outputs.hostname

@description('Static Web App deployment token for CI/CD')
output staticWebAppDeploymentToken string = staticWebApp.outputs.deploymentToken

@description('Static Web App name')
output staticWebAppName string = staticWebApp.outputs.name

@description('Cosmos DB endpoint')
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint

@secure()
@description('SignalR connection string')
output signalRConnectionString string = signalR.outputs.connectionString
