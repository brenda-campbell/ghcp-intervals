@description('Azure region for the VNet (must match SWA region for VNet integration)')
param location string

@description('Environment name (dev, staging, prod)')
param environmentName string

@description('Application name prefix')
param appName string

var vnetName = '${appName}-${environmentName}-vnet'

resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'swa-integration'
        properties: {
          addressPrefix: '10.0.1.0/24'
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.0.2.0/24'
        }
      }
    ]
  }
  tags: {
    environment: environmentName
    app: appName
  }
}

@description('Resource ID of the VNet')
output vnetId string = vnet.id

@description('Resource ID of the SWA integration subnet')
output swaSubnetId string = vnet.properties.subnets[0].id

@description('Resource ID of the private endpoints subnet')
output privateEndpointSubnetId string = vnet.properties.subnets[1].id
