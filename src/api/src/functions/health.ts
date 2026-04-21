import { app, HttpRequest, HttpResponseInit } from "@azure/functions";

async function health(
  request: HttpRequest
): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: { status: "ok", timestamp: new Date().toISOString() },
  };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "healthz",
  handler: health,
});
