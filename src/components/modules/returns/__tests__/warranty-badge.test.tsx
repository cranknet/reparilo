// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import WarrantyBadge from "../warranty-badge";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("WarrantyBadge", () => {
  it("shows in-warranty span when daysSinceDelivered <= warrantyDays", () => {
    renderWithI18n(<WarrantyBadge daysSinceDelivered={10} warrantyDays={30} />);
    const span = screen.getByText(/returns_warranty_in_remaining/i);
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("bg-tertiary-container");
  });

  it("shows out-of-warranty span when exceeded", () => {
    renderWithI18n(<WarrantyBadge daysSinceDelivered={45} warrantyDays={30} />);
    const span = screen.getByText(/returns_warranty_out_past/i);
    expect(span).toBeInTheDocument();
    expect(span).toHaveClass("bg-error-container");
  });

  it("renders nothing when deliveredAt is null", () => {
    const { container } = renderWithI18n(
      <WarrantyBadge daysSinceDelivered={null} warrantyDays={30} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
