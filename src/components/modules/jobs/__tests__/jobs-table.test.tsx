// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { JobRow } from "../jobs-shared";
import JobsTable from "../jobs-table";

const navigateMock = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../technician-select", () => ({
  default: () => <button type="button">technician_select</button>,
}));

vi.mock("../job-actions-menu", () => ({
  default: () => <button type="button">job_actions</button>,
}));

function makeJob(): JobRow {
  return {
    customer: "Amina",
    device: "iPhone 14",
    deviceIcon: "phone_iphone",
    deviceSpec: "Battery",
    id: "R-100",
    rawJob: {
      id: "job-100",
      technician: { id: "tech-1", name: "Samir" },
    } as unknown as JobRow["rawJob"],
    status: "IN_REPAIR",
  };
}

describe("JobsTable", () => {
  it("does not navigate when clicking non-link row space", () => {
    render(
      <MemoryRouter>
        <JobsTable
          jobs={[makeJob()]}
          onToggleSelect={vi.fn()}
          onToggleSelectAll={vi.fn()}
          selectedIds={new Set()}
        />
      </MemoryRouter>
    );

    const rowElement = screen.getByText("status.IN_REPAIR").closest("tr");
    expect(rowElement).not.toBeNull();
    if (rowElement) {
      fireEvent.click(rowElement);
    }

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
