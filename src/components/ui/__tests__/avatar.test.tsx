// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("renders initials when provided", () => {
    render(<Avatar initials="KB" />);
    expect(screen.getByText("KB")).toBeInTheDocument();
  });

  it("renders an image when src is provided", () => {
    render(<Avatar alt="User" src="/photo.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/photo.jpg");
  });
});
