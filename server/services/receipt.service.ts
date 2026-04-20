import type { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";

export async function generateTrackingQr(
  jobCode: string,
  baseUrl: string
): Promise<Buffer> {
  return await QRCode.toBuffer(`${baseUrl}/tracking/${jobCode}`, {
    type: "png",
    width: 200,
  });
}

export async function renderReceiptHtml(
  prisma: PrismaClient,
  job: {
    jobCode: string;
    customer: { name: string; phone: string };
    device: { brand: string; model: string };
    reportedProblem: string;
    estimatedCost: number | { toNumber: () => number };
    createdAt: Date;
    partsUsed: Array<{
      partName: string;
      quantity: number;
      totalCost: number | { toNumber: () => number };
    }>;
    repairs: Array<{
      name: string;
      price: number | { toNumber: () => number };
    }>;
  },
  baseUrl: string
): Promise<string> {
  const settings = await prisma.shopSettings.findUnique({
    where: { id: "default" },
  });
  const shopName = settings?.shopName ?? "Reparilo";
  const qrBuf = await generateTrackingQr(job.jobCode, baseUrl);
  const qrB64 = qrBuf.toString("base64");

  const fmt = (v: number | { toNumber: () => number }) =>
    typeof v === "number" ? v.toLocaleString() : v.toNumber().toLocaleString();

  const estimatedCost = fmt(job.estimatedCost);
  const date = new Date(job.createdAt).toLocaleDateString();

  const partsRows = job.partsUsed
    .map(
      (p) =>
        `<tr><td style="padding:4px 0">${p.partName}</td><td style="text-align:center">${p.quantity}</td><td style="text-align:right">${fmt(p.totalCost)} DZD</td></tr>`
    )
    .join("");

  const repairRows = job.repairs
    .map(
      (r) =>
        `<tr><td style="padding:4px 0">${r.name}</td><td style="text-align:right">${fmt(r.price)} DZD</td></tr>`
    )
    .join("");

  const partsTotal = job.partsUsed.reduce(
    (s, p) =>
      s +
      (typeof p.totalCost === "number" ? p.totalCost : p.totalCost.toNumber()),
    0
  );
  const repairsTotal = job.repairs.reduce(
    (s, r) => s + (typeof r.price === "number" ? r.price : r.price.toNumber()),
    0
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Receipt ${job.jobCode}</title>
<style>
  body{font-family:monospace;margin:0 auto;max-width:280px;padding:8px;font-size:12px}
  h1{text-align:center;font-size:16px;margin:0 0 4px}
  p{text-align:center;margin:0 0 8px;color:#555}
  table{width:100%;border-collapse:collapse;margin:4px 0}
  .sep{border-top:1px dashed #000;margin:8px 0}
  .total td{font-weight:bold;border-top:1px solid #000}
  .qr{text-align:center;margin:8px 0}
  .qr img{width:120px}
  .track{text-align:center;font-size:11px;color:#333;margin:4px 0}
  @media print{body{margin:0;max-width:none}}
</style>
</head>
<body>
<h1>${shopName}</h1>
<p>${date}</p>
<div class="sep"></div>
<table><tr><td>Job</td><td style="text-align:right">${job.jobCode}</td></tr>
<tr><td>Customer</td><td style="text-align:right">${job.customer.name}</td></tr>
<tr><td>Phone</td><td style="text-align:right">${job.customer.phone}</td></tr>
<tr><td>Device</td><td style="text-align:right">${job.device.brand} ${job.device.model}</td></tr></table>
<div class="sep"></div>
<p style="text-align:left"><strong>Problem:</strong> ${job.reportedProblem}</p>
<div class="sep"></div>
${
  partsRows
    ? `<table><tr><th style="text-align:left">Part</th><th>Qty</th><th style="text-align:right">Cost</th></tr>${partsRows}
<tr class="total"><td colspan="2">Parts Total</td><td style="text-align:right">${partsTotal.toLocaleString()} DZD</td></tr></table>`
    : ""
}
${
  repairRows
    ? `<table><tr><th style="text-align:left">Repair</th><th style="text-align:right">Price</th></tr>${repairRows}
<tr class="total"><td>Repairs Total</td><td style="text-align:right">${repairsTotal.toLocaleString()} DZD</td></tr></table>`
    : ""
}
<div class="sep"></div>
<table><tr><td><strong>Estimated Cost</strong></td><td style="text-align:right">${estimatedCost} DZD</td></tr></table>
<div class="sep"></div>
<div class="qr"><img src="data:image/png;base64,${qrB64}" alt="QR Code" /></div>
<p class="track">Scan to track your repair</p>
<p class="track">${baseUrl}/tracking/${job.jobCode}</p>
</body></html>`;
}
