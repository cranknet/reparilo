// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "@/components/ui/icon";

describe("Icon", () => {
  it("renders a material-symbols-outlined span with the given name", () => {
    render(<Icon name="edit" />);
    const el = screen.getByText("edit");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("material-symbols-outlined");
  });

  it("applies default size md (20px)", () => {
    render(<Icon name="check" />);
    const el = screen.getByText("check");
    expect(el).toHaveClass("text-[20px]");
  });

  it("applies size xs (14px)", () => {
    render(<Icon name="close" size="xs" />);
    const el = screen.getByText("close");
    expect(el).toHaveClass("text-[14px]");
  });

  it("applies custom color class", () => {
    render(<Icon color="text-primary" name="error" />);
    const el = screen.getByText("error");
    expect(el).toHaveClass("text-primary");
  });
});
