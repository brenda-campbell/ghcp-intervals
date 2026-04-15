import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import type { HttpResponseInit } from "@azure/functions";
import { createMockRequest, createMockContext } from "../../__tests__/helpers.js";

vi.mock("@azure/functions", () => ({
  app: { http: vi.fn() },
  output: { generic: vi.fn(() => "mockSignalROutput") },
  input: { generic: vi.fn(() => "mockSignalRInput") },
}));

import { app } from "@azure/functions";

type Handler = (req: any, ctx: any) => Promise<HttpResponseInit>;
let handler: Handler;
let registrationOptions: any;

beforeAll(async () => {
  await import("../negotiate.js");
  const call = vi.mocked(app.http).mock.calls[0];
  handler = call[1].handler;
  registrationOptions = call[1];
});

describe("negotiate", () => {
  it("returns SignalR connection info from extraInputs", async () => {
    const connectionInfo = {
      url: "https://myhub.service.signalr.net/client/?hub=gameHub",
      accessToken: "test-token-123",
    };

    const req = createMockRequest();
    const ctx = createMockContext();
    vi.mocked(ctx.extraInputs.get).mockReturnValue(connectionInfo);

    const res = await handler(req, ctx);

    expect(res.jsonBody).toEqual(connectionInfo);
  });

  it("returns undefined when no connection info available", async () => {
    const req = createMockRequest();
    const ctx = createMockContext();
    vi.mocked(ctx.extraInputs.get).mockReturnValue(undefined);

    const res = await handler(req, ctx);

    expect(res.jsonBody).toBeUndefined();
  });

  it("registers with POST method and negotiate route", () => {
    expect(registrationOptions.methods).toContain("POST");
    expect(registrationOptions.route).toBe("negotiate");
  });
});
