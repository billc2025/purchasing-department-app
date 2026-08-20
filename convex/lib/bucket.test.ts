import { describe, expect, it } from "vitest";
import {
  compareBucketOrders,
  matchesBucketFilter,
  normalizeReason,
  priorityGroup,
  type BucketOrder,
} from "./bucket";

const now = Date.UTC(2026, 7, 18, 12);
const base: BucketOrder = {
  id: "a",
  orderNumber: "PH-1",
  status: "assigned",
  requiredAt: now + 60_000,
  isLate: false,
};

describe("purchasing bucket policy", () => {
  it("orders overdue, late exception, unassigned, then remaining active work", () => {
    const rows = [
      base,
      { ...base, id: "u", status: "unassigned" },
      { ...base, id: "e", status: "exception_pending", isLate: true },
      { ...base, id: "o", requiredAt: now - 1 },
    ].sort((a, b) => compareBucketOrders(a, b, now));
    expect(rows.map((row) => row.id)).toEqual(["o", "e", "u", "a"]);
    expect(rows.map((row) => priorityGroup(row, now))).toEqual([0, 1, 2, 3]);
  });

  it("uses required time and stable order number tie-breaks", () => {
    const rows = [
      { ...base, id: "b", orderNumber: "PH-2" },
      { ...base, id: "a", orderNumber: "PH-1" },
      { ...base, id: "c", orderNumber: "PH-3", requiredAt: now + 1 },
    ].sort((a, b) => compareBucketOrders(a, b, now));
    expect(rows.map((row) => row.id)).toEqual(["c", "a", "b"]);
  });

  it("matches operational and personal filters", () => {
    const assigned = { ...base, assignedAgentId: "agent" };
    expect(
      matchesBucketFilter(
        assigned,
        "assigned_to_me",
        "agent",
        now,
        now - 1,
        now + 1,
      ),
    ).toBe(true);
    expect(
      matchesBucketFilter(
        assigned,
        "assigned_to_me",
        "other",
        now,
        now - 1,
        now + 1,
      ),
    ).toBe(false);
    expect(
      matchesBucketFilter(
        { ...base, requiredAt: now - 1 },
        "overdue",
        "agent",
        now,
        now,
        now,
      ),
    ).toBe(true);
  });

  it("requires meaningful reasons", () => {
    expect(normalizeReason("  workload   balancing ")).toBe(
      "workload balancing",
    );
    expect(() => normalizeReason(" ")).toThrow(/reason/i);
  });

  it("keeps orders awaiting approval out of every purchasing work view", () => {
    const pending = { ...base, status: "pending_approval" };
    for (const filter of [
      "all_active",
      "due_today",
      "upcoming",
      "overdue",
    ] as const)
      expect(
        matchesBucketFilter(pending, filter, "agent", now, now - 1, now + 1),
      ).toBe(false);
  });
});
