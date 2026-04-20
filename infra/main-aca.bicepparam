using './main-aca.bicep'

param location = 'northeurope'
param environmentName = 'dev'
param appName = 'fastestfinger'

param azureClientId = readEnvironmentVariable('AZURE_CLIENT_ID')
param azureTenantId = readEnvironmentVariable('AZURE_TENANT_ID')
param azureClientSecret = readEnvironmentVariable('AZURE_CLIENT_SECRET')
