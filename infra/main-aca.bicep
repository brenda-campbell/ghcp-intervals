targetScope = 'resourceGroup'

@description('Azure region for all resources')
param location string = 'northeurope'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Application name prefix used for all resources')
param appName string = 'fastestfinger'

@description('Azure AD client ID (for Cosmos AAD auth)')
param azureClientId string

@description('Azure AD tenant ID')
param azureTenantId string

@description('Azure AD client secret (for Cosmos AAD auth)')
@secure()
param azureClientSecret string

// --- Container Registry ---
module acr 'modules/containerRegistry.bicep' = {
  name: 'deploy-acr'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- Container Apps Environment ---
module containerEnv 'modules/containerAppsEnvironment.bicep' = {
  name: 'deploy-container-env'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- Cosmos DB (reuse existing module) ---
module cosmosDb 'modules/cosmosDb.bicep' = {
  name: 'deploy-cosmosDb'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- SignalR Service (reuse existing module) ---
module signalR 'modules/signalr.bicep' = {
  name: 'deploy-signalR'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// --- API Container App ---
module apiApp 'modules/containerApp-api.bicep' = {
  name: 'deploy-api-app'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    environmentId: containerEnv.outputs.environmentId
    acrLoginServer: acr.outputs.loginServer
    acrName: acr.outputs.name
    cosmosEndpoint: cosmosDb.outputs.endpoint
    signalRConnectionString: signalR.outputs.connectionString
    azureClientId: azureClientId
    azureTenantId: azureTenantId
    azureClientSecret: azureClientSecret
  }
}

// --- Frontend Container App ---
module frontendApp 'modules/containerApp-frontend.bicep' = {
  name: 'deploy-frontend-app'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    environmentId: containerEnv.outputs.environmentId
    acrLoginServer: acr.outputs.loginServer
    acrName: acr.outputs.name
    apiFqdn: apiApp.outputs.fqdn
  }
}

// --- Cosmos DB RBAC: Grant API managed identity data contributor role ---
// Cosmos DB Built-in Data Contributor role ID
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: cosmosDb.outputs.accountName
}

resource cosmosRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = {
  parent: cosmosAccount
  // Use compile-time-resolvable values for the name (principalId is runtime-only)
  name: guid(cosmosAccount.id, '${appName}-${environmentName}-api', cosmosDataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: apiApp.outputs.principalId
    scope: cosmosAccount.id
  }
}

// --- Outputs ---
@description('Frontend application URL')
output frontendUrl string = frontendApp.outputs.url

@description('ACR login server')
output acrLoginServer string = acr.outputs.loginServer

@description('ACR name')
output acrName string = acr.outputs.name

@description('API container app name')
output apiAppName string = apiApp.outputs.name

@description('Frontend container app name')
output frontendAppName string = frontendApp.outputs.name

@description('API internal FQDN')
output apiInternalFqdn string = apiApp.outputs.fqdn

@description('Cosmos DB endpoint')
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint

@secure()
@description('SignalR connection string')
output signalRConnectionString string = signalR.outputs.connectionString
