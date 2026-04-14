// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "@/components/ui/progress-bar";

describe("ProgressBar", () => {
  it("renders a progress bar with role", () => {
    render(<ProgressBar value={75} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("clamps value to 0-100", () => {
    render(<ProgressBar value={150} />);
    const el = screen.getByRole("progressbar");
    expect(el).toHaveAttribute("aria-valuenow", "100");
  });
});
