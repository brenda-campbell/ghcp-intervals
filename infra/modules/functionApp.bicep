@description('Azure region for the Function App')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

@description('Cosmos DB endpoint URL')
param cosmosEndpoint string

@description('SignalR connection string')
param signalRConnectionString string

var functionAppName = '${appName}-${environmentName}-func'
var appServicePlanName = '${appName}-${environmentName}-plan'
var storageNamePrefix = take(replace('${appName}${environmentName}', '-', ''), 11)
var storageName = '${storageNamePrefix}${uniqueString(resourceGroup().id)}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      appSettings: [
        { name: 'AzureWebJobsStorage', value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}' }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
        { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
        { name: 'AzureSignalRConnectionString', value: signalRConnectionString }
      ]
      cors: {
        allowedOrigins: ['*']
      }
    }
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('Function App name')
output name string = functionApp.name

@description('Function App principal ID (managed identity)')
output principalId string = functionApp.identity.principalId

@description('Function App default hostname')
output hostname string = functionApp.properties.defaultHostName

@description('Function App resource ID')
output resourceId string = functionApp.id
