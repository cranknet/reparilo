// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StockBar } from "@/components/ui/stock-bar";

describe("StockBar", () => {
  it("renders level and percentage", () => {
    render(<StockBar level={42} max={50} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
  });

  it("renders low stock with error color", () => {
    const { container } = render(<StockBar level={3} max={50} />);
    const fill = container.querySelector("[style]");
    expect(fill).not.toBeNull();
  });
});
