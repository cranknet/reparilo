// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import ClaimsFilters from "../claims-filters";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe("ClaimsFilters", () => {
  it("calls onChange when status changes", () => {
    const onChange = vi.fn();
    renderWithI18n(<ClaimsFilters value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/status/i), {
      target: { value: "RESOLVED" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "RESOLVED", page: 1 }),
    );
  });

  it("clear button resets all filters", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <ClaimsFilters
        value={{ status: "OPEN", faultCategory: "WORKMANSHIP" }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
