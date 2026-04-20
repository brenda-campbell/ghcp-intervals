using './main-aca.bicep'

param location = 'northeurope'
param environmentName = 'dev'
param appName = 'fastestfinger'

// These are provided at deployment time via --parameters on the CLI
// param azureClientId = ''
// param azureTenantId = ''
// param azureClientSecret = ''
