// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockAddPart = vi.fn();

vi.mock("@/stores/jobs", () => ({
  useJobsStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) => sel({}),
    { getState: () => ({ addPart: mockAddPart }) }
  ),
}));

const mockFetchParts = vi.fn().mockResolvedValue(undefined);
const mockCatalogItems = [
  {
    id: "part-1",
    name: "iPhone 15 Screen",
    category: "SCREEN",
    defaultPrice: 15_000,
    supplier: "FixParts",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "part-2",
    name: "Samsung Battery",
    category: "BATTERY",
    defaultPrice: 3500,
    supplier: "BatteryCo",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

vi.mock("@/stores/parts-catalog", () => ({
  usePartsCatalogStore: () => ({
    parts: mockCatalogItems,
    isLoading: false,
    fetchParts: mockFetchParts,
  }),
}));

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock("@/stores/toast", () => ({
  useToastStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ toast: mockToast, undoToast: vi.fn() }),
}));

import AddPartDialog from "../add-part-dialog";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AddPartDialog", () => {
  const defaultProps = {
    jobId: "job-123",
    onAdded: vi.fn(),
    onClose: vi.fn(),
    open: true,
  };

  it("renders with catalog tab and calls fetchParts on open", async () => {
    render(<AddPartDialog {...defaultProps} />);

    expect(screen.getByText("jobs_parts_catalog_tab")).toBeInTheDocument();
    expect(screen.getByText("jobs_parts_custom_tab")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "jobs_parts_add" })
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetchParts).toHaveBeenCalledWith({
        isActive: true,
        search: undefined,
      });
    });
  });

  it("returns null when not open", () => {
    const { container } = render(
      <AddPartDialog {...defaultProps} open={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows catalog items in the list", () => {
    render(<AddPartDialog {...defaultProps} />);

    expect(screen.getByText("iPhone 15 Screen")).toBeInTheDocument();
    expect(screen.getByText("Samsung Battery")).toBeInTheDocument();
  });

  it("picks a catalog item and populates form fields", () => {
    render(<AddPartDialog {...defaultProps} />);

    // Click a catalog item
    fireEvent.click(screen.getByText("iPhone 15 Screen"));

    // Form fields should be populated
    const nameInput = screen.getByDisplayValue(
      "iPhone 15 Screen"
    ) as HTMLInputElement;
    expect(nameInput).toBeDisabled(); // disabled when partId is set

    const priceInput = document.getElementById(
      "add-part-price"
    ) as HTMLInputElement;
    expect(priceInput.value).toBe("15000");

    const supplierInput = document.getElementById(
      "add-part-supplier"
    ) as HTMLInputElement;
    expect(supplierInput.value).toBe("FixParts");
  });

  it("switches to custom tab", () => {
    render(<AddPartDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("jobs_parts_custom_tab"));

    // Catalog items should no longer be shown
    expect(screen.queryByText("iPhone 15 Screen")).not.toBeInTheDocument();
    expect(screen.queryByText("Samsung Battery")).not.toBeInTheDocument();

    // fetchParts should not be called again after switching to custom
    // (it was already called once on mount for catalog mode)
    const customCalls = mockFetchParts.mock.calls.filter(
      (call) =>
        (call[0] as { search?: string } | undefined)?.search !== undefined
    );
    expect(customCalls.length).toBe(0);
  });

  it("calls onAdded and onClose on successful submit", async () => {
    mockAddPart.mockResolvedValue(undefined);
    render(<AddPartDialog {...defaultProps} />);

    // Fill form manually (custom mode)
    fireEvent.click(screen.getByText("jobs_parts_custom_tab"));

    const nameInput = document.getElementById(
      "add-part-name"
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Custom Part" } });

    const priceInput = document.getElementById(
      "add-part-price"
    ) as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: "5000" } });

    // Submit — the submit button is the last element with text "jobs_parts_add"
    const submitBtn = screen.getAllByText("jobs_parts_add").at(-1);
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn as HTMLElement);

    await waitFor(() => {
      expect(mockAddPart).toHaveBeenCalledWith(
        "job-123",
        expect.objectContaining({
          partName: "Custom Part",
          unitPrice: 5000,
          quantity: 1,
          category: "OTHER",
        })
      );
    });

    expect(defaultProps.onAdded).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls addPart with partId when submitting a catalog item", async () => {
    mockAddPart.mockResolvedValue(undefined);
    render(<AddPartDialog {...defaultProps} />);

    // Pick a catalog item
    fireEvent.click(screen.getByText("iPhone 15 Screen"));

    // Submit
    const submitBtn = screen.getAllByText("jobs_parts_add").at(-1);
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn as HTMLElement);

    await waitFor(() => {
      expect(mockAddPart).toHaveBeenCalledWith(
        "job-123",
        expect.objectContaining({
          partId: "part-1",
          partName: "iPhone 15 Screen",
          category: "SCREEN",
          unitPrice: 15_000,
          quantity: 1,
          supplier: "FixParts",
        })
      );
    });
  });

  it("shows error on failed submit", async () => {
    mockAddPart.mockRejectedValue(new Error("fail"));
    render(<AddPartDialog {...defaultProps} />);

    fireEvent.click(screen.getByText("jobs_parts_custom_tab"));

    const nameInput = document.getElementById(
      "add-part-name"
    ) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Bad Part" } });

    const priceInput = document.getElementById(
      "add-part-price"
    ) as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: "100" } });

    const submitBtn = screen.getAllByText("jobs_parts_add").at(-1);
    expect(submitBtn).toBeDefined();
    fireEvent.click(submitBtn as HTMLElement);

    await waitFor(() => {
      expect(
        screen.getByText("jobs_status_change_error_unknown")
      ).toBeInTheDocument();
    });

    expect(defaultProps.onAdded).not.toHaveBeenCalled();
  });

  it("closes on Escape key", () => {
    render(<AddPartDialog {...defaultProps} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
