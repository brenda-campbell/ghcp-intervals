import { describe, it, expect, beforeEach } from "vitest";
import {
  recordCorrectAnswer,
  getFastestCorrectMs,
  clearFastestForQuestion,
  _resetFastestTracker,
} from "../fastestAnswerTracker.js";

describe("fastestAnswerTracker", () => {
  beforeEach(() => {
    _resetFastestTracker();
  });

  it("returns undefined for unknown question", () => {
    expect(getFastestCorrectMs("q-unknown")).toBeUndefined();
  });

  it("records the first correct answer as fastest", () => {
    recordCorrectAnswer("q1", 3000);
    expect(getFastestCorrectMs("q1")).toBe(3000);
  });

  it("updates fastest when a faster answer arrives", () => {
    recordCorrectAnswer("q1", 3000);
    recordCorrectAnswer("q1", 1500);
    expect(getFastestCorrectMs("q1")).toBe(1500);
  });

  it("does not update fastest when a slower answer arrives", () => {
    recordCorrectAnswer("q1", 1500);
    recordCorrectAnswer("q1", 3000);
    expect(getFastestCorrectMs("q1")).toBe(1500);
  });

  it("tracks different questions independently", () => {
    recordCorrectAnswer("q1", 2000);
    recordCorrectAnswer("q2", 5000);
    expect(getFastestCorrectMs("q1")).toBe(2000);
    expect(getFastestCorrectMs("q2")).toBe(5000);
  });

  it("clearFastestForQuestion removes only the specified question", () => {
    recordCorrectAnswer("q1", 2000);
    recordCorrectAnswer("q2", 3000);
    clearFastestForQuestion("q1");
    expect(getFastestCorrectMs("q1")).toBeUndefined();
    expect(getFastestCorrectMs("q2")).toBe(3000);
  });

  it("_resetFastestTracker clears all data", () => {
    recordCorrectAnswer("q1", 2000);
    recordCorrectAnswer("q2", 3000);
    _resetFastestTracker();
    expect(getFastestCorrectMs("q1")).toBeUndefined();
    expect(getFastestCorrectMs("q2")).toBeUndefined();
  });
});
