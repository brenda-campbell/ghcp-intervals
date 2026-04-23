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
