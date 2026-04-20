@description('Azure region for the Container Registry')
param location string

@description('Environment name (dev, staging, prod)')
@minLength(2)
param environmentName string

@description('Application name prefix')
@minLength(3)
param appName string

// ACR names must be alphanumeric only (no hyphens)
var registryName = '${appName}${environmentName}acr'

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('ACR login server (e.g. myacr.azurecr.io)')
output loginServer string = containerRegistry.properties.loginServer

@description('ACR resource name')
output name string = containerRegistry.name
