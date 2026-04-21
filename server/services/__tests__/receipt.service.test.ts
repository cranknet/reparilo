import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { renderLabelHtml } from "../receipt.service.js";

const QR_BASE64_RE = /<img[^>]+src="data:image\/png;base64,[A-Za-z0-9+/=]+"/;

function makePrisma(shopName = "Reparilo Test Shop"): PrismaClient {
  return {
    shopSettings: {
      findUnique: vi.fn().mockResolvedValue({ id: "default", shopName }),
    },
  } as unknown as PrismaClient;
}

const baseJob = {
  jobCode: "JOB-0042",
  customer: { name: "John Doe", phone: "+213555000000" },
  device: { brand: "iPhone", model: "13 Pro" },
  reportedProblem: "Cracked screen",
  estimatedCost: 8500,
  createdAt: new Date("2026-04-21T10:00:00Z"),
  partsUsed: [],
  repairs: [],
};

describe("renderLabelHtml", () => {
  it("includes shop name, device, problem and price", async () => {
    const html = await renderLabelHtml(
      makePrisma("Acme Repairs"),
      baseJob,
      "https://example.com"
    );
    expect(html).toContain("Acme Repairs");
    expect(html).toContain("iPhone");
    expect(html).toContain("13 Pro");
    expect(html).toContain("Cracked screen");
    expect(html).toContain("8,500");
  });

  it("does not show job code in the label body", async () => {
    const html = await renderLabelHtml(makePrisma(), baseJob, "https://x.y");
    expect(html).not.toContain("JOB-0042");
  });

  it("embeds a base64 QR code in left column", async () => {
    const html = await renderLabelHtml(
      makePrisma(),
      baseJob,
      "https://example.com"
    );
    expect(html).toMatch(QR_BASE64_RE);
  });

  it("sets @page size to 40mm 20mm and triggers print on load", async () => {
    const html = await renderLabelHtml(makePrisma(), baseJob, "https://x.y");
    expect(html).toContain("size: 40mm 20mm");
    expect(html).toContain("window.print()");
  });

  it("hides price when hideCosts is true", async () => {
    const html = await renderLabelHtml(makePrisma(), baseJob, "https://x.y", {
      hideCosts: true,
    });
    expect(html).not.toContain("8,500");
    expect(html).not.toContain("DZD");
  });

  it("shows finalCost (parts+repairs) over estimatedCost when parts/repairs exist", async () => {
    const jobWithParts = {
      ...baseJob,
      estimatedCost: 0,
      partsUsed: [{ partName: "Screen", quantity: 1, totalCost: 3000 }],
      repairs: [{ repairName: "Replace", price: 2000 }],
    };
    const html = await renderLabelHtml(
      makePrisma(),
      jobWithParts,
      "https://x.y"
    );
    expect(html).toContain("5,000");
  });

  it("escapes HTML in user-supplied fields", async () => {
    const malicious = {
      ...baseJob,
      reportedProblem: "<script>alert(1)</script>",
      device: { brand: 'Acme"', model: "<b>X</b>" },
    };
    const html = await renderLabelHtml(makePrisma(), malicious, "https://x.y");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;");
  });

  it("falls back to 'Reparilo' when shopName is empty", async () => {
    const prisma = {
      shopSettings: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;
    const html = await renderLabelHtml(prisma, baseJob, "https://x.y");
    expect(html).toContain("Reparilo");
  });

  it("renders logo image when logoPath is set", async () => {
    const prisma = {
      shopSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          shopName: "Acme",
          logoPath: "data:image/png;base64,abc123",
        }),
      },
    } as unknown as PrismaClient;
    const html = await renderLabelHtml(prisma, baseJob, "https://x.y");
    expect(html).toContain('src="data:image/png;base64,abc123"');
    expect(html).not.toContain(">Acme<");
  });

  it("renders shop name text when logoPath is null", async () => {
    const prisma = {
      shopSettings: {
        findUnique: vi.fn().mockResolvedValue({
          id: "default",
          shopName: "Acme",
          logoPath: null,
        }),
      },
    } as unknown as PrismaClient;
    const html = await renderLabelHtml(prisma, baseJob, "https://x.y");
    expect(html).toContain(">Acme</div>");
  });
});
