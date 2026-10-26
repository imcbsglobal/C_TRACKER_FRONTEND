import { jsPDF } from "jspdf";
import { STATUSES } from "../constants";

const GREEN = [63, 104, 57];
const SOFT = [228, 237, 224];
const TEXT = [28, 38, 27];
const MUTED = [93, 104, 90];
const LINE = [211, 220, 205];

const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "");

// Builds a clean, multi-page A4 PDF of a task and returns it as a File.
export function buildTaskPdf(c) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const maxW = W - M * 2;
  let y = 0;

  const ensure = (h) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };

  const write = (
    text,
    { size = 11, bold = false, color = TEXT, gap = 0, x = M, width = maxW } = {}
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lh = size * 1.4;
    doc.splitTextToSize(String(text), width).forEach((line) => {
      ensure(lh);
      doc.text(line, x, y + size);
      y += lh;
    });
    y += gap;
  };

  const rule = () => {
    ensure(20);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);
    y += 18;
  };

  // ---------- Header band ----------
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, W, 64, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Task details", M, 40);
  y = 92;

  // ---------- Task number + title ----------
  const num = c.task_number || `#${c.id}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const numW = doc.getTextWidth(num) + 16;
  doc.setFillColor(...SOFT);
  doc.rect(M, y, numW, 20, "F");
  doc.setTextColor(...GREEN);
  doc.text(num, M + 8, y + 14);
  y += 34;

  write(c.title || "Untitled", { size: 22, bold: true, gap: 4 });
  write(
    `Created ${fmtDate(c.created_at)}${
      c.created_by_name ? ` by ${c.created_by_name}` : ""
    }`,
    { size: 9.5, color: MUTED, gap: 16 }
  );
  rule();

  // ---------- Properties ----------
  const statusLabel =
    STATUSES.find((s) => s.value === c.status)?.label || c.status || "";
  const helpers = (c.helpers_names || []).join(", ");

  const props = [
    ["Status", statusLabel],
    ["Assignee", c.assigned_to_name || "Unassigned"],
    ["Due date", c.due_date || "—"],
    ["Category", c.category || "—"],
    ["Helpers", helpers || "—"],
    ["Customer", c.customer || "—"],
    ["Phone", c.phone || "—"],
  ];

  const LABEL_W = 110;
  props.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(String(value), maxW - LABEL_W);
    const rowH = Math.max(1, lines.length) * 15.4 + 6;
    ensure(rowH);
    doc.setTextColor(...MUTED);
    doc.text(label, M, y + 11);
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", label === "Status" ? "bold" : "normal");
    lines.forEach((line, i) => doc.text(line, M + LABEL_W, y + 11 + i * 15.4));
    y += rowH;
  });
  y += 8;
  rule();

  // ---------- Follow-ups ----------
  const followups = c.followups || [];
  write(`Follow-ups (${followups.length})`, {
    size: 13,
    bold: true,
    color: GREEN,
    gap: 6,
  });
  if (followups.length === 0) {
    write("No follow-ups yet", { size: 10.5, color: MUTED, gap: 8 });
  }
  followups.forEach((f) => {
    ensure(48);
    write(`${f.created_by_name || "Someone"}  ·  ${fmtDate(f.created_at)}`, {
      size: 9.5,
      bold: true,
      color: MUTED,
    });
    write(f.note, { size: 11, gap: 10 });
  });
  y += 4;
  rule();

  // ---------- Description ----------
  write("Description", { size: 13, bold: true, color: GREEN, gap: 6 });
  write(c.description?.trim() || "No description", {
    size: 11,
    color: c.description?.trim() ? TEXT : MUTED,
  });

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`${num}  ·  Generated ${new Date().toLocaleString()}`, M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: "right" });
  }

  const safe = (c.title || "task").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  const filename = `${String(num).replace("#", "")}-${safe || "task"}.pdf`;
  return new File([doc.output("blob")], filename, { type: "application/pdf" });
}