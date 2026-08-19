import { describe, expect, it } from "vitest";
import {
  computeLeadTime,
  validateAttachment,
  validateBilling,
  validateItems,
} from "./orderValidation";

const item = {
  name: "Coffee",
  specification: "Dark roast",
  quantity: 2,
  unit: "bags",
  estimatedAmountMinor: 2500,
  substitutionAllowed: true,
};

describe("billing responsibility", () => {
  it("requires a client reference for client-billed orders", () =>
    expect(() => validateBilling("client", " ")).toThrow(/Client reference/));
  it("removes client data from internal orders", () =>
    expect(validateBilling("internal", "Old client")).toBeUndefined());
});

describe("multi-item order validation", () => {
  it("accepts multiple valid items and preserves integer minor units", () =>
    expect(validateItems([item, { ...item, name: "Cups" }])).toHaveLength(2));
  it("rejects empty orders", () =>
    expect(() => validateItems([])).toThrow(/require/));
  it("rejects fractional minor units", () =>
    expect(() =>
      validateItems([{ ...item, estimatedAmountMinor: 2.5 }]),
    ).toThrow(/minor units/));
});

describe("continuous calendar lead time", () => {
  const friday = Date.UTC(2026, 7, 21, 22, 0);
  it("includes weekends without business-day adjustment", () =>
    expect(
      computeLeadTime(friday, friday + 3 * 24 * 60 * 60_000, 4320).isLate,
    ).toBe(false));
  it("treats one millisecond before the boundary as late", () =>
    expect(computeLeadTime(friday, friday + 60 * 60_000 - 1, 60).isLate).toBe(
      true,
    ));
  it("accepts the exact boundary", () =>
    expect(computeLeadTime(friday, friday + 60 * 60_000, 60).isLate).toBe(
      false,
    ));
});

describe("reference image validation", () => {
  it("allows supported images within 8 MB", () =>
    expect(() => validateAttachment("image/png", 1024)).not.toThrow());
  it("rejects executable content and oversized images", () => {
    expect(() => validateAttachment("text/html", 1024)).toThrow(/JPEG/);
    expect(() => validateAttachment("image/jpeg", 9 * 1024 * 1024)).toThrow(
      /8 MB/,
    );
  });
});
