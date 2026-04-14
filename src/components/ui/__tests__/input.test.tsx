// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("renders iconStart before input", () => {
    render(<Input iconStart="person" placeholder="User" />);
    const icon = screen.getByText("person");
    expect(icon).toHaveClass("material-symbols-outlined");
  });

  it("renders iconEnd after input", () => {
    render(<Input iconEnd="visibility_off" placeholder="Pass" />);
    const icon = screen.getByText("visibility_off");
    expect(icon).toHaveClass("material-symbols-outlined");
  });

  it("applies base input styles", () => {
    render(<Input placeholder="Test" />);
    const el = screen.getByPlaceholderText("Test");
    expect(el).toHaveClass("bg-surface-container-lowest");
    expect(el).toHaveClass("rounded-xl");
  });
});
