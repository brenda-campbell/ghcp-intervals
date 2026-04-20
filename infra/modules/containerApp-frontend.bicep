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

@description('Internal FQDN of the API container app')
param apiFqdn string

var appNameFull = '${appName}-${environmentName}-frontend'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource frontendContainerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: appNameFull
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [
        {
          name: 'acr-password'
          value: acr.listCredentials().passwords[0].value
        }
      ]
      ingress: {
        external: true
        targetPort: 80
        transport: 'http'
      }
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
          name: 'frontend'
          image: '${acrLoginServer}/${appName}-frontend:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: [
            { name: 'API_FQDN', value: apiFqdn }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/'
                port: 80
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
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

@description('Frontend container app name')
output name string = frontendContainerApp.name

@description('Frontend container app public FQDN')
output fqdn string = frontendContainerApp.properties.configuration.ingress.fqdn

@description('Frontend app URL')
output url string = 'https://${frontendContainerApp.properties.configuration.ingress.fqdn}'
