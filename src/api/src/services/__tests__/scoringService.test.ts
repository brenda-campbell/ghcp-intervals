import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../cosmosClient.js", () => ({
  usersContainer: {
    item: vi.fn(),
  },
  questionsContainer: { items: { query: vi.fn() } },
  database: {},
}));

import { updateUserScore, incrementGamesPlayed } from "../scoringService.js";
import { usersContainer } from "../cosmosClient.js";

describe("updateUserScore", () => {
  const mockRead = vi.fn();
  const mockPatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.item).mockReturnValue({
      read: mockRead,
      patch: mockPatch,
    } as any);
  });

  it("increments score (not gamesPlayed — that is per-round now)", async () => {
    mockRead.mockResolvedValue({
      resource: {
        userId: "u1",
        totalScore: 100,
        gamesPlayed: 5,
        fastestTimeMs: 3000,
      },
    });
    mockPatch.mockResolvedValue({});

    await updateUserScore("u1", 150, 2500);

    expect(usersContainer.item).toHaveBeenCalledWith("u1", "u1");
    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({ op: "incr", path: "/totalScore", value: 150 });
    // gamesPlayed is NOT incremented per answer — only via incrementGamesPlayed()
    expect(ops).not.toContainEqual(expect.objectContaining({ path: "/gamesPlayed" }));
  });

  it("updates fastestTimeMs when new time is faster", async () => {
    mockRead.mockResolvedValue({
      resource: { fastestTimeMs: 3000 },
    });
    mockPatch.mockResolvedValue({});

    await updateUserScore("u1", 100, 2500);

    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({
      op: "replace",
      path: "/fastestTimeMs",
      value: 2500,
    });
  });

  it("keeps fastestTimeMs when current is faster", async () => {
    mockRead.mockResolvedValue({
      resource: { fastestTimeMs: 1000 },
    });
    mockPatch.mockResolvedValue({});

    await updateUserScore("u1", 100, 2500);

    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({
      op: "replace",
      path: "/fastestTimeMs",
      value: 1000,
    });
  });

  it("sets fastestTimeMs when null (first game)", async () => {
    mockRead.mockResolvedValue({
      resource: { fastestTimeMs: null },
    });
    mockPatch.mockResolvedValue({});

    await updateUserScore("u1", 100, 5000);

    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({
      op: "replace",
      path: "/fastestTimeMs",
      value: 5000,
    });
  });

  it("sets fastestTimeMs when undefined", async () => {
    mockRead.mockResolvedValue({
      resource: { fastestTimeMs: undefined },
    });
    mockPatch.mockResolvedValue({});

    await updateUserScore("u1", 100, 4000);

    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({
      op: "replace",
      path: "/fastestTimeMs",
      value: 4000,
    });
  });

  it("throws when user not found", async () => {
    mockRead.mockResolvedValue({ resource: undefined });

    await expect(updateUserScore("missing", 100, 5000)).rejects.toThrow(
      "User missing not found"
    );
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it("handles zero points awarded", async () => {
    mockRead.mockResolvedValue({
      resource: { fastestTimeMs: 3000 },
    });
    mockPatch.mockResolvedValue({});

    await updateUserScore("u1", 0, 10000);

    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({ op: "incr", path: "/totalScore", value: 0 });
  });

  it("sets updatedAt to current ISO timestamp", async () => {
    mockRead.mockResolvedValue({
      resource: { fastestTimeMs: 3000 },
    });
    mockPatch.mockResolvedValue({});

    const before = new Date().toISOString();
    await updateUserScore("u1", 100, 2000);
    const after = new Date().toISOString();

    const ops = mockPatch.mock.calls[0][0];
    const updatedAtOp = ops.find(
      (op: any) => op.path === "/updatedAt"
    );
    expect(updatedAtOp.op).toBe("replace");
    expect(updatedAtOp.value >= before).toBe(true);
    expect(updatedAtOp.value <= after).toBe(true);
  });
});

describe("incrementGamesPlayed", () => {
  const mockPatch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersContainer.item).mockReturnValue({
      patch: mockPatch,
    } as any);
    mockPatch.mockResolvedValue({});
  });

  it("increments gamesPlayed by 1", async () => {
    await incrementGamesPlayed("u1");

    expect(usersContainer.item).toHaveBeenCalledWith("u1", "u1");
    const ops = mockPatch.mock.calls[0][0];
    expect(ops).toContainEqual({ op: "incr", path: "/gamesPlayed", value: 1 });
  });

  it("sets updatedAt", async () => {
    const before = new Date().toISOString();
    await incrementGamesPlayed("u1");
    const after = new Date().toISOString();

    const ops = mockPatch.mock.calls[0][0];
    const updatedAtOp = ops.find((op: any) => op.path === "/updatedAt");
    expect(updatedAtOp.op).toBe("replace");
    expect(updatedAtOp.value >= before).toBe(true);
    expect(updatedAtOp.value <= after).toBe(true);
  });
});
