targetScope = 'resourceGroup'

@description('Azure region for the Function App, VNet, storage and private endpoints')
param location string = 'westeurope'

@description('Azure region for Cosmos DB and SignalR (kept separate to avoid moving existing data)')
param cosmosLocation string = 'northeurope'

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Application name prefix used for all resources')
param appName string = 'fastestfinger'

@description('Admin passcode used by the loginOrCreate API for elevated login')
@secure()
param adminPasscode string = 'CopilotDevDays2026'

@description('Whether to (re)deploy RBAC role assignments. Set to false in CI when the deploying SP lacks Microsoft.Authorization/roleAssignments/write. Role assignments are idempotent once applied.')
param deployRoleAssignments bool = true

// --- Static Web App ---
// SWA is managed outside Bicep while its ARM resource provider lock clears.
// The SWA already exists and is deployed via the CI/CD workflow directly.
// After first Function App deploy, CI/CD links it as the SWA's backend
// via `az staticwebapp backends link`.

// -----------------------------------------------------------------------------
// Data + messaging
// -----------------------------------------------------------------------------
module cosmosDb 'modules/cosmosDb.bicep' = {
  name: 'deploy-cosmosDb'
  params: {
    location: cosmosLocation
    environmentName: environmentName
    appName: appName
  }
}

module signalR 'modules/signalr.bicep' = {
  name: 'deploy-signalR'
  params: {
    location: cosmosLocation
    environmentName: environmentName
    appName: appName
  }
}

// -----------------------------------------------------------------------------
// Networking (VNet with private-endpoint + Function App integration subnets)
// -----------------------------------------------------------------------------
module networking 'modules/networking.bicep' = {
  name: 'deploy-networking'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// -----------------------------------------------------------------------------
// Function App backing storage (needs private endpoint below)
// -----------------------------------------------------------------------------
module storage 'modules/storage.bicep' = {
  name: 'deploy-storage'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
  }
}

// -----------------------------------------------------------------------------
// Private endpoints (Cosmos DB + SignalR + Storage blob)
// Storage PE is required for Flex Consumption because MCAPS policy forces
// publicNetworkAccess=Disabled on storage, and the SCM plane can only reach
// the deployment container via the private endpoint.
// -----------------------------------------------------------------------------
module privateEndpoints 'modules/privateEndpoints.bicep' = {
  name: 'deploy-privateEndpoints'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    vnetId: networking.outputs.vnetId
    privateEndpointSubnetId: networking.outputs.privateEndpointSubnetId
    cosmosDbAccountId: cosmosDb.outputs.resourceId
    signalRId: signalR.outputs.resourceId
    storageAccountId: storage.outputs.resourceId
  }
}

// -----------------------------------------------------------------------------
// Function App (Flex Consumption + VNet integration + user-assigned MI)
// -----------------------------------------------------------------------------
module functionApp 'modules/functionApp.bicep' = {
  name: 'deploy-functionApp'
  params: {
    location: location
    environmentName: environmentName
    appName: appName
    functionSubnetId: networking.outputs.functionSubnetId
    storageAccountName: storage.outputs.name
    deploymentContainerUrl: storage.outputs.deploymentContainerUrl
    cosmosEndpoint: cosmosDb.outputs.endpoint
    signalRName: signalR.outputs.name
    adminPasscode: adminPasscode
  }
}

// -----------------------------------------------------------------------------
// Role assignments — grant the Function App UAMI access to Cosmos, SignalR, Storage
// -----------------------------------------------------------------------------
module roleAssignments 'modules/roleAssignments.bicep' = if (deployRoleAssignments) {
  name: 'deploy-roleAssignments'
  params: {
    principalId: functionApp.outputs.uamiPrincipalId
    cosmosAccountName: cosmosDb.outputs.accountName
    signalRName: signalR.outputs.name
    storageAccountName: storage.outputs.name
  }
}

// -----------------------------------------------------------------------------
// Outputs
// -----------------------------------------------------------------------------
@description('Cosmos DB endpoint')
output cosmosDbEndpoint string = cosmosDb.outputs.endpoint

@description('Function App name (used by CI/CD to deploy code and link to SWA)')
output functionAppName string = functionApp.outputs.name

@description('Function App default hostname (used by SWA linked backend + smoke tests)')
output functionAppHostname string = functionApp.outputs.hostname

@description('Function App resource ID (used by SWA linked backend command)')
output functionAppResourceId string = functionApp.outputs.resourceId

@description('User-assigned managed identity client ID (for AZURE_CLIENT_ID app setting)')
output functionAppUamiClientId string = functionApp.outputs.uamiClientId
