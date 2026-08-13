@description('Azure region for the storage account')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

// Storage account name: globally unique, 3-24 lowercase alphanumeric.
var storageName = toLower(replace('${appName}${environmentName}st${uniqueString(resourceGroup().id)}', '-', ''))
var deploymentContainerName = 'app-package'

resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: length(storageName) > 24 ? substring(storageName, 0, 24) : storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storage
  name: 'default'
  properties: {}
}

resource deploymentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: deploymentContainerName
  properties: {
    publicAccess: 'None'
  }
}

@description('Storage account name')
output name string = storage.name

@description('Storage account resource ID')
output resourceId string = storage.id

@description('Blob service primary endpoint (e.g. https://<acct>.blob.core.windows.net/)')
output blobEndpoint string = storage.properties.primaryEndpoints.blob

@description('Deployment blob container URL for Flex Consumption app package')
output deploymentContainerUrl string = '${storage.properties.primaryEndpoints.blob}${deploymentContainerName}'

@description('Deployment blob container name')
output deploymentContainerName string = deploymentContainerName
