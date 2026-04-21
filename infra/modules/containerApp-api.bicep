@description('Azure region')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

@description('Container Apps Environment resource ID')
param environmentId string

@description('ACR login server (e.g. myacr.azurecr.io)')
param acrLoginServer string

@description('ACR resource name')
param acrName string

@description('Cosmos DB endpoint URL')
param cosmosEndpoint string

@description('Azure SignalR connection string')
@secure()
param signalRConnectionString string

@description('Azure AD client ID for Cosmos AAD auth')
param azureClientId string

@description('Azure AD tenant ID')
param azureTenantId string

@description('Azure AD client secret for Cosmos AAD auth')
@secure()
param azureClientSecret string

@description('Container image to deploy (defaults to placeholder for initial provisioning)')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

var appNameFull = '${appName}-${environmentName}-api'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource apiContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appNameFull
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: 80
        transport: 'http'
        allowInsecure: true
      }
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'signalr-connection-string'
          value: signalRConnectionString
        }
        {
          name: 'azure-client-secret'
          value: azureClientSecret
        }
      ]
      registries: [
        {
          server: acrLoginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
            { name: 'AzureWebJobsStorage', value: '' }
            { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
            { name: 'AZURE_CLIENT_ID', value: azureClientId }
            { name: 'AZURE_TENANT_ID', value: azureTenantId }
            { name: 'AZURE_CLIENT_SECRET', secretRef: 'azure-client-secret' }
            { name: 'AzureSignalRConnectionString', secretRef: 'signalr-connection-string' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/healthz'
                port: 80
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/healthz'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 5
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

// Add ACR password as a secret — need to update the config after creation
// This is handled by referencing ACR credentials directly in the registries config

@description('API container app name')
output name string = apiContainerApp.name

@description('API container app internal FQDN')
output fqdn string = apiContainerApp.properties.configuration.ingress.fqdn

@description('API container app principal ID (managed identity)')
output principalId string = apiContainerApp.identity.principalId
