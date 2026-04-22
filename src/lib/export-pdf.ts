import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { JobRow } from "@/components/modules/jobs/jobs-shared";

type JobRowKey = keyof JobRow;

interface ColumnDef {
  key: JobRowKey;
  label: string;
}

interface ExportPdfOptions {
  columns: ColumnDef[];
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

  const body = rows.map((row) =>
    columns.map((col) => row[col.key]?.toString() ?? "")
  );

  autoTable(doc, {
    head: [columns.map((col) => col.label)],
    body,
    startY: 28,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [33, 150, 243] },
  });

  doc.save(filename);
}
