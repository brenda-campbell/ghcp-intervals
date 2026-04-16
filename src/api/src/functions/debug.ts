import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

async function debug(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const identityVars: Record<string, string> = {};
  // List ALL env vars with identity/MSI/token related names
  for (const [key, val] of Object.entries(process.env)) {
    if (/identity|msi|token|secret|header|cosmos|signalr|azure|website|function/i.test(key)) {
      identityVars[key] = (val && (key.includes("Connection") || key.includes("SECRET") || key.includes("HEADER") || key.includes("KEY")))
        ? `${val.substring(0, 15)}...(set, len=${val.length})`
        : val ?? "(null)";
    }
  }

  // Also try calling MSI endpoint to see exact error
  let msiResult = "not attempted";
  const endpoint = process.env.IDENTITY_ENDPOINT ?? process.env.MSI_ENDPOINT;
  if (endpoint) {
    try {
      const url = `${endpoint}?api-version=2019-08-01&resource=https%3A%2F%2Fcosmos.azure.com`;
      const headers: Record<string, string> = {};
      if (process.env.IDENTITY_HEADER) headers["X-IDENTITY-HEADER"] = process.env.IDENTITY_HEADER;
      const resp = await fetch(url, { headers });
      msiResult = `${resp.status}: ${(await resp.text()).substring(0, 200)}`;
    } catch (e) {
      msiResult = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return {
    status: 200,
    jsonBody: { env: identityVars, msiResult, nodeVersion: process.version },
  };
}

app.http("debug", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "debug",
  handler: debug,
});
