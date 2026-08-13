@description('Azure region for SignalR Service')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

var signalRName = '${appName}-${environmentName}-signalr'

resource signalR 'Microsoft.SignalRService/signalR@2024-03-01' = {
  name: signalRName
  location: location
  sku: {
    name: 'Standard_S1'
    tier: 'Standard'
    capacity: 1
  }
  kind: 'SignalR'
  properties: {
    features: [
      {
        flag: 'ServiceMode'
        value: 'Serverless'
      }
      {
        flag: 'EnableConnectivityLogs'
        value: 'True'
      }
    ]
    cors: {
      allowedOrigins: ['*']
    }
    publicNetworkAccess: 'Enabled'
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('SignalR Service hostname')
output hostname string = signalR.properties.hostName

@description('SignalR connection string')
output connectionString string = signalR.listKeys().primaryConnectionString

@description('SignalR resource name')
output name string = signalR.name

@description('SignalR resource ID')
output resourceId string = signalR.id
