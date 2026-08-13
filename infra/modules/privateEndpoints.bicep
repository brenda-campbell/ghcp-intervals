@description('Azure region for private endpoints (must match VNet region)')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

@description('Resource ID of the subnet for private endpoints')
param privateEndpointSubnetId string

@description('Resource ID of the VNet')
param vnetId string

@description('Resource ID of the Cosmos DB account')
param cosmosDbAccountId string

@description('Resource ID of the SignalR service')
param signalRId string

@description('Resource ID of the storage account (for Flex Consumption deployment container)')
param storageAccountId string

// =============================================================================
// Cosmos DB Private Endpoint
// =============================================================================

var cosmosPrivateEndpointName = '${appName}-${environmentName}-cosmos-pe'

resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: cosmosPrivateEndpointName
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${cosmosPrivateEndpointName}-conn'
        properties: {
          privateLinkServiceId: cosmosDbAccountId
          groupIds: ['Sql']
        }
      }
    ]
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource cosmosDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.documents.azure.com'
  location: 'global'
  tags: {
    environment: environmentName
    app: appName
  }
}

resource cosmosDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: cosmosDnsZone
  name: '${appName}-${environmentName}-cosmos-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

resource cosmosDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: cosmosPrivateEndpoint
  name: 'cosmos-dns-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cosmos-dns-config'
        properties: {
          privateDnsZoneId: cosmosDnsZone.id
        }
      }
    ]
  }
}

// =============================================================================
// SignalR Private Endpoint
// =============================================================================

var signalRPrivateEndpointName = '${appName}-${environmentName}-signalr-pe'

resource signalRPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: signalRPrivateEndpointName
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${signalRPrivateEndpointName}-conn'
        properties: {
          privateLinkServiceId: signalRId
          groupIds: ['signalr']
        }
      }
    ]
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource signalRDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.service.signalr.net'
  location: 'global'
  tags: {
    environment: environmentName
    app: appName
  }
}

resource signalRDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: signalRDnsZone
  name: '${appName}-${environmentName}-signalr-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

resource signalRDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: signalRPrivateEndpoint
  name: 'signalr-dns-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'signalr-dns-config'
        properties: {
          privateDnsZoneId: signalRDnsZone.id
        }
      }
    ]
  }
}

@description('Name of the SignalR private endpoint (needed for networkACL reference)')
output signalRPrivateEndpointName string = signalRPrivateEndpoint.name

// =============================================================================
// Storage Account (Blob) Private Endpoint
// Required for Flex Consumption: the SCM plane runs inside the Function App's
// delegated subnet and must reach the deployment blob container. When the
// storage account has publicNetworkAccess=Disabled (enforced by MCAPS policy),
// a private endpoint on the "blob" sub-resource is the only reachable path.
// =============================================================================

var storagePrivateEndpointName = '${appName}-${environmentName}-storage-pe'

resource storagePrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-01-01' = {
  name: storagePrivateEndpointName
  location: location
  properties: {
    subnet: {
      id: privateEndpointSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: '${storagePrivateEndpointName}-conn'
        properties: {
          privateLinkServiceId: storageAccountId
          groupIds: ['blob']
        }
      }
    ]
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

resource storageBlobDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.blob.${environment().suffixes.storage}'
  location: 'global'
  tags: {
    environment: environmentName
    app: appName
  }
}

resource storageBlobDnsZoneVnetLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: storageBlobDnsZone
  name: '${appName}-${environmentName}-storage-vnet-link'
  location: 'global'
  properties: {
    virtualNetwork: {
      id: vnetId
    }
    registrationEnabled: false
  }
}

resource storageBlobDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-01-01' = {
  parent: storagePrivateEndpoint
  name: 'storage-dns-group'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'storage-blob-dns-config'
        properties: {
          privateDnsZoneId: storageBlobDnsZone.id
        }
      }
    ]
  }
}
