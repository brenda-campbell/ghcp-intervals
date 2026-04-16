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

// --- Standalone Function App (replaces SWA managed functions) ---
module functionApp 'modules/functionApp.bicep' = {
  name: 'deploy-functionApp'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    cosmosEndpoint: cosmosDb.outputs.endpoint
    signalRConnectionString: signalR.outputs.connectionString
  }
}

// --- Cosmos DB RBAC: Grant Function App managed identity data access ---
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: '${appName}-${environmentName}-cosmos'
}

resource cosmosRbac 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, '${appName}-${environmentName}-func', 'cosmos-data-contributor')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/00000000-0000-0000-0000-000000000002'
    principalId: functionApp.outputs.principalId
    scope: cosmosAccount.id
  }
  dependsOn: [cosmosDb]
}

// --- Link Function App as SWA backend (proxies /api/* to Function App) ---
resource swaResource 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: '${appName}-${environmentName}-swa'
}

resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2022-09-01' = {
  parent: swaResource
  name: 'backend1'
  properties: {
    backendResourceId: functionApp.outputs.resourceId
    region: location
  }
  dependsOn: [staticWebApp]
}

// --- Outputs ---
@description('Static Web App default hostname')
output staticWebAppHostname string = staticWebApp.outputs.hostname

@description('Static Web App deployment token for CI/CD')
output staticWebAppDeploymentToken string = staticWebApp.outputs.deploymentToken

@description('Function App name')
output functionAppName string = functionApp.outputs.name

@description('Cosmos DB endpoint')
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint

@description('SignalR hostname')
output signalRHostname string = signalR.outputs.hostname
