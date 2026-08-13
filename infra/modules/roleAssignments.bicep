@description('Principal ID of the identity to grant roles to (Function App UAMI)')
param principalId string

@description('Cosmos DB account name (data-plane role via Cosmos SQL RBAC)')
param cosmosAccountName string

@description('SignalR service name (control/data plane roles)')
param signalRName string

@description('Storage account name (blob roles for deployment container + AzureWebJobsStorage)')
param storageAccountName string

// -----------------------------------------------------------------------------
// Cosmos DB — SQL Data Plane role assignment
// Role: Cosmos DB Built-in Data Contributor (00000000-0000-0000-0000-000000000002)
// -----------------------------------------------------------------------------
resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-02-15-preview' existing = {
  name: cosmosAccountName
}

var cosmosDataContributorRoleDefinitionId = resourceId(
  'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions',
  cosmosAccountName,
  '00000000-0000-0000-0000-000000000002'
)

resource cosmosRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-02-15-preview' = {
  parent: cosmos
  name: guid(cosmos.id, principalId, 'data-contributor')
  properties: {
    roleDefinitionId: cosmosDataContributorRoleDefinitionId
    principalId: principalId
    scope: cosmos.id
  }
}

// -----------------------------------------------------------------------------
// SignalR — Service Owner
// Role: SignalR Service Owner (7e4f1700-ea5a-4f59-8f37-079cfe29dce3)
// -----------------------------------------------------------------------------
resource signalR 'Microsoft.SignalRService/signalR@2024-03-01' existing = {
  name: signalRName
}

resource signalRRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(signalR.id, principalId, 'signalr-service-owner')
  scope: signalR
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7e4f1700-ea5a-4f59-8f37-079cfe29dce3'
    )
  }
}

// -----------------------------------------------------------------------------
// Storage — Blob Data Owner (needed for AzureWebJobsStorage identity + deployment package)
// Role: Storage Blob Data Owner (b7e6dc6d-f1e8-4753-8033-0f276bb0955b)
// -----------------------------------------------------------------------------
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' existing = {
  name: storageAccountName
}

resource storageRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storage.id, principalId, 'blob-data-owner')
  scope: storage
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
    )
  }
}
