export function Badge({ text, tone = "neutral", subtle = false }) {
  return `<span class="yx-badge yx-badge--${tone} ${subtle ? "yx-badge--subtle" : ""}">${escapeHtml(text)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
