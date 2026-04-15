// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders badge with children text", () => {
    render(<Badge>VIP</Badge>);
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("applies primary variant by default", () => {
    render(<Badge>Test</Badge>);
    const el = screen.getByText("Test");
    expect(el).toHaveClass("bg-primary-fixed");
  });

  it("applies error variant", () => {
    render(<Badge variant="error">Low</Badge>);
    const el = screen.getByText("Low");
    expect(el).toHaveClass("bg-error-container");
  });

  it("applies sm size", () => {
    render(<Badge size="sm">S</Badge>);
    const el = screen.getByText("S");
    expect(el).toHaveClass("px-2");
    expect(el).toHaveClass("text-xs");
  });

  it("applies md size by default", () => {
    render(<Badge>M</Badge>);
    const el = screen.getByText("M");
    expect(el).toHaveClass("px-3");
    expect(el).toHaveClass("text-xs");
  });
});
