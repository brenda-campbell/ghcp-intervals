@description('Azure region for the Function App')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

@description('Resource ID of the subnet to use for VNet integration (must be delegated to Microsoft.App/environments)')
param functionSubnetId string

@description('Storage account name for the Function App runtime + deployment package')
param storageAccountName string

@description('Deployment blob container URL (e.g. https://<acct>.blob.core.windows.net/app-package)')
param deploymentContainerUrl string

@description('Cosmos DB endpoint (used as COSMOS_ENDPOINT app setting)')
param cosmosEndpoint string

@description('SignalR service hostname (used as AzureSignalRConnectionString-style app setting)')
param signalRName string

@description('Admin passcode used by loginOrCreate for elevated login')
@secure()
param adminPasscode string = 'CopilotDevDays2026'

var functionAppName = '${appName}-${environmentName}-func'
var planName = '${appName}-${environmentName}-plan'
var uamiName = '${appName}-${environmentName}-func-mi'

// -----------------------------------------------------------------------------
// User-assigned managed identity (used for Cosmos, SignalR and Storage auth)
// -----------------------------------------------------------------------------
resource uami 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-07-31-preview' = {
  name: uamiName
  location: location
  tags: {
    environment: environmentName
    app: appName
  }
}

// -----------------------------------------------------------------------------
// Flex Consumption plan
// -----------------------------------------------------------------------------
resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
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

// Reference existing storage account so we can grant RBAC to the UAMI in roleAssignments.bicep
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

// Reference existing SignalR to build the AzureSignalRConnectionString identity-based endpoint value
resource signalR 'Microsoft.SignalRService/signalR@2024-03-01' existing = {
  name: signalRName
}

// -----------------------------------------------------------------------------
// Function App (Flex Consumption)
// -----------------------------------------------------------------------------
resource functionApp 'Microsoft.Web/sites@2024-04-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${uami.id}': {}
    }
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    virtualNetworkSubnetId: functionSubnetId
    vnetRouteAllEnabled: true
    publicNetworkAccess: 'Enabled'
    keyVaultReferenceIdentity: uami.id
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: deploymentContainerUrl
          authentication: {
            type: 'UserAssignedIdentity'
            userAssignedIdentityResourceId: uami.id
          }
        }
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 40
        instanceMemoryMB: 2048
      }
      runtime: {
        name: 'node'
        version: '20'
      }
    }
    siteConfig: {
      appSettings: [
        {
          name: 'AzureWebJobsStorage__accountName'
          value: storage.name
        }
        {
          name: 'AzureWebJobsStorage__credential'
          value: 'managedidentity'
        }
        {
          name: 'AzureWebJobsStorage__clientId'
          value: uami.properties.clientId
        }
        {
          name: 'COSMOS_ENDPOINT'
          value: cosmosEndpoint
        }
        {
          name: 'AZURE_CLIENT_ID'
          value: uami.properties.clientId
        }
        {
          // Identity-based SignalR connection (serverless mode via AAD).
          name: 'AzureSignalRConnectionString'
          value: 'Endpoint=https://${signalR.properties.hostName};AuthType=aad;ClientId=${uami.properties.clientId};Version=1.0;'
        }
        {
          name: 'ADMIN_PASSCODE'
          value: adminPasscode
        }
      ]
      cors: {
        allowedOrigins: [
          'https://portal.azure.com'
        ]
        supportCredentials: false
      }
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('Function App name')
output name string = functionApp.name

@description('Function App default hostname')
output hostname string = functionApp.properties.defaultHostName

@description('Function App resource ID')
output resourceId string = functionApp.id

@description('Principal ID of the user-assigned managed identity used by the Function App')
output uamiPrincipalId string = uami.properties.principalId

@description('Client ID of the user-assigned managed identity')
output uamiClientId string = uami.properties.clientId

@description('Resource ID of the user-assigned managed identity')
output uamiResourceId string = uami.id
