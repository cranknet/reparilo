// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import ClaimsFilters from "../claims-filters";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

const STATUS_REGEX = /status/i;
const CLEAR_REGEX = /clear/i;

describe("ClaimsFilters", () => {
  it("calls onChange when status changes", () => {
    const onChange = vi.fn();
    renderWithI18n(<ClaimsFilters onChange={onChange} value={{}} />);

    fireEvent.change(screen.getByLabelText(STATUS_REGEX), {
      target: { value: "RESOLVED" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "RESOLVED", page: 1 })
    );
  });

  it("clear button resets all filters", () => {
    const onChange = vi.fn();
    renderWithI18n(
      <ClaimsFilters
        onChange={onChange}
        value={{ status: "OPEN", faultCategory: "WORKMANSHIP" }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: CLEAR_REGEX }));
    expect(onChange).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
