import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/api", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  getErrorMessage: (err: unknown, fallback: string) => {
    if (typeof err === "object" && err !== null && "code" in err) {
      return (err as { message?: string }).message || fallback;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return fallback;
  },
}));

vi.mock("@/i18n", () => ({
  default: { t: (key: string) => key },
}));

import type { Job } from "@shared/types";
import { useJobsStore } from "../jobs";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    jobCode: "RPR-001",
    status: "INTAKE",
    accessCode: "1234",
    color: null,
    conditionNotes: null,
    reportedProblem: "Broken screen",
    estimatedCost: { toNumber: () => 100 } as unknown as Job["estimatedCost"],
    estimatedDate: null,
    depositAmount: null,
    isWarrantyReturn: false,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    customer: {
      id: "cust-1",
      name: "John",
      phone: "123",
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    device: {
      id: "dev-1",
      brandId: "brand-1",
      model: "iPhone 15",
      brand: {
        id: "brand-1",
        name: "Apple",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    technician: null,
    photos: [],
    notes: [],
    partsUsed: [],
    repairs: [],
    ...overrides,
  } as Job;
}

beforeEach(() => {
  vi.clearAllMocks();
  useJobsStore.setState({
    jobs: [],
    metrics: null,
    totalCount: 0,
    nextCursor: null,
    isLoadingJobs: false,
    isLoadingMetrics: false,
    isCreatingJob: false,
    error: null,
  });
});

describe("useJobsStore", () => {
  describe("fetchJobs", () => {
    it("sets jobs from API response", async () => {
      const jobs = [makeJob(), makeJob({ id: "job-2" })];
      mockGet.mockResolvedValue({
        data: { jobs, nextCursor: "cursor-abc", totalCount: 42 },
      });

      await act(() => useJobsStore.getState().fetchJobs());

      const state = useJobsStore.getState();
      expect(state.jobs).toEqual(jobs);
      expect(state.nextCursor).toBe("cursor-abc");
      expect(state.totalCount).toBe(42);
      expect(state.isLoadingJobs).toBe(false);
      expect(state.error).toBeNull();
    });

    it("defaults nextCursor and totalCount when absent", async () => {
      mockGet.mockResolvedValue({ data: { jobs: [] } });

      await act(() => useJobsStore.getState().fetchJobs());

      const state = useJobsStore.getState();
      expect(state.nextCursor).toBeNull();
      expect(state.totalCount).toBe(0);
    });

    it("handles error and sets isLoadingJobs false", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));

      await act(() => useJobsStore.getState().fetchJobs());

      const state = useJobsStore.getState();
      expect(state.isLoadingJobs).toBe(false);
      expect(state.error).toBe("Network error");
    });

    it("uses i18n fallback for non-Error failures", async () => {
      mockGet.mockRejectedValue("unknown");

      await act(() => useJobsStore.getState().fetchJobs());

      expect(useJobsStore.getState().error).toBe("errors.fetch_jobs");
    });
  });

  describe("createJob", () => {
    it("adds job to list and returns it", async () => {
      const newJob = makeJob();
      mockPost.mockResolvedValue({ data: newJob });

      const result = await act(() =>
        useJobsStore.getState().createJob({
          customerName: "John",
          customerPhone: "123",
          deviceBrand: "Apple",
          deviceModel: "iPhone 15",
          reportedProblem: "Broken screen",
          estimatedCost: 100,
        })
      );

      expect(result).toEqual(newJob);
      const state = useJobsStore.getState();
      expect(state.jobs).toHaveLength(1);
      expect(state.jobs[0]).toEqual(newJob);
      expect(state.totalCount).toBe(1);
      expect(state.isCreatingJob).toBe(false);
    });

    it("handles error and throws", async () => {
      mockPost.mockRejectedValue(new Error("Create failed"));

      await expect(
        act(() =>
          useJobsStore.getState().createJob({
            customerName: "John",
            customerPhone: "123",
            deviceBrand: "Apple",
            deviceModel: "iPhone 15",
            reportedProblem: "Broken screen",
            estimatedCost: 100,
          })
        )
      ).rejects.toThrow("Create failed");

      const state = useJobsStore.getState();
      expect(state.error).toBe("Create failed");
      expect(state.isCreatingJob).toBe(false);
    });
  });

  describe("transitionStatus", () => {
    it("updates job status in list", async () => {
      const updated = makeJob({ status: "IN_REPAIR" });
      useJobsStore.setState({ jobs: [makeJob()] });
      mockPatch.mockResolvedValue({ data: updated });

      const result = await act(() =>
        useJobsStore.getState().transitionStatus("job-1", "IN_REPAIR")
      );

      expect(result).toEqual(updated);
      expect(useJobsStore.getState().jobs[0].status).toBe("IN_REPAIR");
      expect(mockPatch).toHaveBeenCalledWith("/jobs/job-1/status", {
        status: "IN_REPAIR",
        reason: undefined,
      });
    });

    it("passes reason when provided", async () => {
      const updated = makeJob({ status: "ON_HOLD" });
      useJobsStore.setState({ jobs: [makeJob()] });
      mockPatch.mockResolvedValue({ data: updated });

      await act(() =>
        useJobsStore
          .getState()
          .transitionStatus("job-1", "ON_HOLD", "waiting part")
      );

      expect(mockPatch).toHaveBeenCalledWith("/jobs/job-1/status", {
        status: "ON_HOLD",
        reason: "waiting part",
      });
    });
  });

  describe("updateJob", () => {
    it("patches and updates job in list", async () => {
      const updated = makeJob({
        estimatedCost: {
          toNumber: () => 200,
        } as unknown as Job["estimatedCost"],
      });
      useJobsStore.setState({ jobs: [makeJob()] });
      mockPatch.mockResolvedValue({ data: updated });

      const result = await act(() =>
        useJobsStore.getState().updateJob("job-1", { estimatedCost: 200 })
      );

      expect(result).toEqual(updated);
      expect(useJobsStore.getState().jobs[0].estimatedCost).toBe(200);
      expect(mockPatch).toHaveBeenCalledWith("/jobs/job-1", {
        estimatedCost: 200,
      });
    });
  });

  describe("addNote", () => {
    it("adds note to job's notes array", async () => {
      const note = { id: "note-1", content: "Check screen" };
      useJobsStore.setState({ jobs: [makeJob()] });
      mockPost.mockResolvedValue({ data: note });

      const result = await act(() =>
        useJobsStore.getState().addNote("job-1", "Check screen")
      );

      expect(result).toEqual(note);
      const job = useJobsStore.getState().jobs[0];
      expect(job.notes).toHaveLength(1);
      expect(job.notes?.[0]).toEqual(note);
    });
  });

  describe("addPart", () => {
    it("adds part to job's partsUsed array", async () => {
      const part = {
        id: "part-1",
        partName: "Screen",
        unitPrice: 50,
        quantity: 1,
      };
      useJobsStore.setState({ jobs: [makeJob()] });
      mockPost.mockResolvedValue({ data: part });

      const result = await act(() =>
        useJobsStore.getState().addPart("job-1", {
          partName: "Screen",
          category: "Display",
          unitPrice: 50,
        })
      );

      expect(result).toEqual(part);
      const job = useJobsStore.getState().jobs[0];
      expect(job.partsUsed).toHaveLength(1);
      expect(job.partsUsed?.[0]).toEqual(part);
    });
  });

  describe("removePart", () => {
    it("filters part from job's partsUsed", async () => {
      useJobsStore.setState({
        jobs: [
          makeJob({
            partsUsed: [
              {
                id: "part-1",
                partName: "Screen",
              } as unknown as Job["partsUsed"][number],
              {
                id: "part-2",
                partName: "Battery",
              } as unknown as Job["partsUsed"][number],
            ],
          }),
        ],
      });
      mockDelete.mockResolvedValue({});

      await act(() => useJobsStore.getState().removePart("job-1", "part-1"));

      const job = useJobsStore.getState().jobs[0];
      expect(job.partsUsed).toHaveLength(1);
      expect(job.partsUsed?.[0].id).toBe("part-2");
      expect(mockDelete).toHaveBeenCalledWith("/jobs/job-1/parts/part-1");
    });
  });

  describe("addRepair", () => {
    it("adds repair to job's repairs array", async () => {
      const repair = {
        id: "repair-1",
        repairName: "Screen replacement",
        price: 80,
      };
      useJobsStore.setState({ jobs: [makeJob()] });
      mockPost.mockResolvedValue({ data: repair });

      const result = await act(() =>
        useJobsStore.getState().addRepair("job-1", {
          repairName: "Screen replacement",
          category: "Display",
          price: 80,
        })
      );

      expect(result).toEqual(repair);
      const job = useJobsStore.getState().jobs[0];
      expect(job.repairs).toHaveLength(1);
      expect(job.repairs?.[0]).toEqual(repair);
    });
  });

  describe("removeRepair", () => {
    it("filters repair from job's repairs", async () => {
      useJobsStore.setState({
        jobs: [
          makeJob({
            repairs: [
              {
                id: "repair-1",
                repairName: "Screen",
              } as unknown as Job["repairs"][number],
              {
                id: "repair-2",
                repairName: "Battery",
              } as unknown as Job["repairs"][number],
            ],
          }),
        ],
      });
      mockDelete.mockResolvedValue({});

      await act(() =>
        useJobsStore.getState().removeRepair("job-1", "repair-1")
      );

      const job = useJobsStore.getState().jobs[0];
      expect(job.repairs).toHaveLength(1);
      expect(job.repairs?.[0].id).toBe("repair-2");
      expect(mockDelete).toHaveBeenCalledWith("/jobs/job-1/repairs/repair-1");
    });
  });

  describe("clearError", () => {
    it("resets error state", () => {
      useJobsStore.setState({ error: "Something went wrong" });

      useJobsStore.getState().clearError();

      expect(useJobsStore.getState().error).toBeNull();
    });
  });

  describe("fetchJobById", () => {
    it("updates existing job in list", async () => {
      useJobsStore.setState({ jobs: [makeJob()] });
      const updated = makeJob({ status: "IN_REPAIR" });
      mockGet.mockResolvedValue({ data: updated });

      const result = await act(() =>
        useJobsStore.getState().fetchJobById("job-1")
      );

      expect(result).toEqual(updated);
      expect(useJobsStore.getState().jobs).toHaveLength(1);
      expect(useJobsStore.getState().jobs[0].status).toBe("IN_REPAIR");
    });

    it("prepends new job when not in list", async () => {
      useJobsStore.setState({ jobs: [] });
      const job = makeJob();
      mockGet.mockResolvedValue({ data: job });

      const result = await act(() =>
        useJobsStore.getState().fetchJobById("job-1")
      );

      expect(result).toEqual(job);
      expect(useJobsStore.getState().jobs).toHaveLength(1);
      expect(useJobsStore.getState().jobs[0].id).toBe("job-1");
    });

    it("handles error and throws", async () => {
      mockGet.mockRejectedValue(new Error("Not found"));

      await expect(
        act(() => useJobsStore.getState().fetchJobById("job-999"))
      ).rejects.toThrow("Not found");

      expect(useJobsStore.getState().error).toBe("Not found");
    });
  });
});
