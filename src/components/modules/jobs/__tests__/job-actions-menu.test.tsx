// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JobRow } from "../jobs-shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockTransitionStatus = vi.fn().mockResolvedValue({});

vi.mock("@/stores/jobs", () => ({
  useJobsStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ transitionStatus: mockTransitionStatus }),
}));

vi.mock("../job-note-dialog", () => ({
  default: () => <div data-testid="note-dialog" />,
  __esModule: true,
}));

vi.mock("../job-cancel-dialog", () => ({
  default: () => <div data-testid="cancel-dialog" />,
  __esModule: true,
}));

import JobActionsMenu from "../job-actions-menu";

function makeJob(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "test-id",
    customer: "John",
    device: "iPhone 15",
    deviceIcon: "smartphone",
    status: "IN_REPAIR",
    rawJob: {
      id: "raw-id",
      customer: { phone: "+1234567890" } as never,
    } as never,
    ...overrides,
  };
}

describe("JobActionsMenu", () => {
  it("renders the more_vert button", () => {
    render(<JobActionsMenu job={makeJob()} />);
    expect(
      screen.getByRole("button", { name: "job_actions" })
    ).toBeInTheDocument();
  });

  it("opens dropdown on button click", () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    expect(screen.getByText("job_actions_change_status")).toBeInTheDocument();
    expect(screen.getByText("job_actions_add_note")).toBeInTheDocument();
    expect(screen.getByText("job_actions_call_customer")).toBeInTheDocument();
    expect(screen.getByText("job_actions_print_receipt")).toBeInTheDocument();
    expect(screen.getByText("job_actions_cancel_job")).toBeInTheDocument();
  });

  it("shows valid status transitions for IN_REPAIR", () => {
    render(<JobActionsMenu job={makeJob({ status: "IN_REPAIR" })} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    // IN_REPAIR → ["ON_HOLD", "DONE", "CANCELLED"]; statusTransitions filters out CANCELLED
    expect(screen.getByText("status.ON_HOLD")).toBeInTheDocument();
    expect(screen.getByText("status.DONE")).toBeInTheDocument();
  });

  it("hides cancel option when CANCELLED not in valid transitions", () => {
    render(<JobActionsMenu job={makeJob({ status: "DONE" })} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    // DONE → ["DELIVERED", "RETURNED"], no CANCELLED
    expect(
      screen.queryByText("job_actions_cancel_job")
    ).not.toBeInTheDocument();
  });

  it("closes dropdown on Escape key", () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    expect(screen.getByText("job_actions_change_status")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.queryByText("job_actions_change_status")
    ).not.toBeInTheDocument();
  });

  it("disables print receipt button", () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    const printBtn = screen
      .getByText("job_actions_print_receipt")
      .closest("button");
    expect(printBtn).not.toBeNull();
    expect(printBtn).toBeDisabled();
  });

  it("renders nothing for terminal status without customer phone", () => {
    const { container } = render(
      <JobActionsMenu
        job={makeJob({ status: "DELIVERED", rawJob: undefined })}
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("opens note dialog when Add Note is clicked", async () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    fireEvent.click(screen.getByText("job_actions_add_note"));
    await waitFor(() => {
      expect(screen.getByTestId("note-dialog")).toBeInTheDocument();
    });
  });

  it("opens cancel dialog when Cancel Job is clicked", async () => {
    render(<JobActionsMenu job={makeJob()} />);
    fireEvent.click(screen.getByRole("button", { name: "job_actions" }));
    fireEvent.click(screen.getByText("job_actions_cancel_job"));
    await waitFor(() => {
      expect(screen.getByTestId("cancel-dialog")).toBeInTheDocument();
    });
  });
});
