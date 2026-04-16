import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

async function debug(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const identityVars: Record<string, string> = {};
  const interesting = [
    "IDENTITY_ENDPOINT", "IDENTITY_HEADER",
    "MSI_ENDPOINT", "MSI_SECRET",
    "WEBSITE_INSTANCE_ID", "WEBSITE_SITE_NAME",
    "AZURE_CLIENT_ID", "AZURE_TENANT_ID",
    "COSMOS_ENDPOINT", "CosmosDBConnectionString",
    "AzureSignalRConnectionString",
    "FUNCTIONS_WORKER_RUNTIME", "FUNCTIONS_EXTENSION_VERSION",
  ];

  for (const key of interesting) {
    const val = process.env[key];
    identityVars[key] = val
      ? (key.includes("Connection") || key.includes("SECRET") || key.includes("HEADER"))
        ? `${val.substring(0, 10)}...(set)`
        : val
      : "(not set)";
  }

  return {
    status: 200,
    jsonBody: { env: identityVars, nodeVersion: process.version },
  };
}

app.http("debug", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "debug",
  handler: debug,
});
