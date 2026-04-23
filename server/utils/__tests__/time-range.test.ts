import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { monthRange, todayRange, toMoney } from "../time-range.js";

describe("todayRange", () => {
  it("returns [startOfDay, startOfNextDay) in the given IANA zone", () => {
    const now = new Date("2026-04-23T10:00:00Z");
    const r = todayRange("Africa/Algiers", now);
    expect(r.start.toISOString()).toBe("2026-04-22T23:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-04-23T23:00:00.000Z");
  });
});

describe("monthRange", () => {
  it("returns first-of-month to first-of-next-month in the given zone", () => {
    const now = new Date("2026-04-23T10:00:00Z");
    const r = monthRange("Africa/Algiers", now);
    expect(r.start.toISOString()).toBe("2026-03-31T23:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-04-30T23:00:00.000Z");
  });
});

describe("toMoney", () => {
  it("rounds Decimal to two places", () => {
    expect(toMoney(new Prisma.Decimal("12.345"))).toBe(12.35);
    expect(toMoney(new Prisma.Decimal("0"))).toBe(0);
  });
  it("treats null/undefined as 0", () => {
    expect(toMoney(null)).toBe(0);
    expect(toMoney(undefined)).toBe(0);
  });
});
