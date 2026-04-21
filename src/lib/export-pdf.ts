import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { JobRow } from "@/components/modules/jobs/jobs-shared";

interface ExportPdfOptions {
  columns: string[];
  filename: string;
  rows: JobRow[];
  title: string;
}

export function exportJobsPdf({
  columns,
  rows,
  title,
  filename,
}: ExportPdfOptions) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 20);

  const body = rows.map((row) => [
    row.id,
    row.customer,
    row.device,
    row.status,
    row.technician ?? "",
  ]);

  autoTable(doc, {
    head: [columns],
    body,
    startY: 28,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [33, 150, 243] },
  });

  doc.save(filename);
}
