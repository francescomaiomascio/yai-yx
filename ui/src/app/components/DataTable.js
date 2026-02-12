import { Badge } from "./Badge.js";

export function DataTable({ id, rows, kind }) {
  return `
    <div class="yx-table" id="${id}">
      <div class="yx-table__head">
        <span>Time</span>
        <span>Severity</span>
        <span>Topic</span>
        <span>Summary</span>
      </div>
      ${rows
        .map(
          (row, idx) => `
        <button class="yx-table__row" data-kind="${kind}" data-idx="${idx}">
          <span>${new Date(row.ts_ms).toLocaleTimeString()}</span>
          <span>${Badge({ text: row.severity.toUpperCase(), tone: tone(row.severity), subtle: true })}</span>
          <span>${row.topic}</span>
          <span>${escapeHtml(row.summary || "-")}</span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function tone(sev) {
  if (sev === "error") return "deny";
  if (sev === "warn") return "warn";
  return "ok";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
