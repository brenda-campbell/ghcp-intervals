@description('Azure region')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

var environmentName_safe = '${appName}-${environmentName}'
var logAnalyticsName = '${environmentName_safe}-logs'
var envName = '${environmentName_safe}-env'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('Container Apps Environment resource ID')
output environmentId string = containerAppsEnvironment.id

@description('Default domain of the Container Apps Environment')
output defaultDomain string = containerAppsEnvironment.properties.defaultDomain
