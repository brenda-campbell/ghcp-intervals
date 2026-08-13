using './main.bicep'

// Function App + VNet + storage + private endpoints live in westeurope
// (VNet was already provisioned there — do not move it).
param location = 'westeurope'

// Cosmos DB + SignalR were provisioned in northeurope and hold data — do not move.
param cosmosLocation = 'northeurope'

param environmentName = 'dev'
param appName = 'fastestfinger'
