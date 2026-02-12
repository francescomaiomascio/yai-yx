import { Badge } from "./Badge.js";

export function FeedList({ id, items, emptyText = "No data", kind = "events" }) {
  if (!items.length) {
    return `<div class="yx-empty">${emptyText}</div>`;
  }

  return `
    <div class="yx-feed" id="${id}">
      ${items
        .map(
          (item, idx) => `
        <button class="yx-feed__row" data-kind="${kind}" data-idx="${idx}">
          <span class="yx-feed__time">${formatTime(item.ts_ms)}</span>
          <span class="yx-feed__topic">${item.topic}</span>
          <span class="yx-feed__sev">${Badge({ text: item.severity.toUpperCase(), tone: tone(item.severity), subtle: true })}</span>
          <span class="yx-feed__summary">${escapeHtml(item.summary || "-")}</span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function formatTime(ts) {
  return new Date(ts || Date.now()).toLocaleTimeString();
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
