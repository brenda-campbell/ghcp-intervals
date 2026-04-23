@description('Azure region for the Static Web App')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

var staticWebAppName = '${appName}-${environmentName}-swa'

// Reference existing SWA resource (avoids Conflict lock from in-progress ARM operations).
// To restore full resource management, replace 'existing' with a full resource declaration.
resource staticWebApp 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: staticWebAppName
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
