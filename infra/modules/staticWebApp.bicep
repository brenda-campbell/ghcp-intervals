@description('Azure region for the Static Web App')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

@description('Resource ID of the subnet for SWA VNet integration')
param swaSubnetId string = ''

var staticWebAppName = '${appName}-${environmentName}-swa'

resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: '/client'
      apiLocation: '/api'
      outputLocation: 'dist'
    }
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('Default hostname of the Static Web App')
output hostname string = staticWebApp.properties.defaultHostname

@description('Resource ID of the Static Web App')
output resourceId string = staticWebApp.id

@description('Name of the Static Web App')
output name string = staticWebApp.name

@description('Principal ID of the system-assigned managed identity')
output principalId string = staticWebApp.identity.principalId

@description('Deployment token for CI/CD')
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey

// --- VNet Integration ---
resource swaNetworkConfig 'Microsoft.Web/staticSites/networkConfig@2023-12-01' = if (!empty(swaSubnetId)) {
  parent: staticWebApp
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: swaSubnetId
  }
}
