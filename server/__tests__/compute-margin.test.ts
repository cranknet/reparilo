import { describe, expect, it } from "vitest";
import { computeMargin } from "../services/job.service.js";

describe("computeMargin", () => {
  it("computes margin as finalCost minus parts cost", () => {
    const margin = computeMargin({
      finalCost: 5000,
      partsUsed: [{ totalCost: 2000 }, { totalCost: 1000 }],
    });
    expect(margin).toBe(2000);
  });

  it("returns negative margin when parts exceed finalCost", () => {
    const margin = computeMargin({
      finalCost: 2000,
      partsUsed: [{ totalCost: 3000 }],
    });
    expect(margin).toBe(-1000);
  });

  it("handles Decimal-like objects with toNumber", () => {
    const margin = computeMargin({
      finalCost: { toNumber: () => 8000 },
      partsUsed: [{ totalCost: { toNumber: () => 3000 } }],
    });
    expect(margin).toBe(5000);
  });

  it("returns full finalCost as margin when no parts", () => {
    const margin = computeMargin({
      finalCost: 5000,
      partsUsed: [],
    });
    expect(margin).toBe(5000);
  });
});
