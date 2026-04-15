import { describe, it, expect } from "vitest";
import {
  recordDelivery,
  getDeliveryTimestamp,
  clearDelivery,
} from "../questionDeliveryTracker.js";

describe("questionDeliveryTracker", () => {
  it("records and retrieves delivery timestamps", () => {
    const ts = 1700000000000;
    recordDelivery("q-rec-1", "u-rec-1", ts);
    expect(getDeliveryTimestamp("q-rec-1", "u-rec-1")).toBe(ts);
  });

  it("returns undefined for unrecorded deliveries", () => {
    expect(getDeliveryTimestamp("q-unknown", "u-unknown")).toBeUndefined();
  });

  it("clears delivery records", () => {
    recordDelivery("q-clear-1", "u-clear-1", Date.now());
    clearDelivery("q-clear-1", "u-clear-1");
    expect(getDeliveryTimestamp("q-clear-1", "u-clear-1")).toBeUndefined();
  });

  it("uses default timestamp (Date.now) when not provided", () => {
    const before = Date.now();
    recordDelivery("q-def-1", "u-def-1");
    const after = Date.now();

    const ts = getDeliveryTimestamp("q-def-1", "u-def-1");
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("isolates timestamps per question-user pair", () => {
    recordDelivery("q-iso-1", "u-iso-1", 1000);
    recordDelivery("q-iso-1", "u-iso-2", 2000);
    recordDelivery("q-iso-2", "u-iso-1", 3000);

    expect(getDeliveryTimestamp("q-iso-1", "u-iso-1")).toBe(1000);
    expect(getDeliveryTimestamp("q-iso-1", "u-iso-2")).toBe(2000);
    expect(getDeliveryTimestamp("q-iso-2", "u-iso-1")).toBe(3000);
  });

  it("overwrites existing delivery on re-record", () => {
    recordDelivery("q-over-1", "u-over-1", 1000);
    recordDelivery("q-over-1", "u-over-1", 2000);
    expect(getDeliveryTimestamp("q-over-1", "u-over-1")).toBe(2000);
  });
});
