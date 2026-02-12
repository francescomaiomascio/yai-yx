import { Card } from "../components/Card.js";

export function MindView(state) {
  const recent = (state.mind.activations || []).slice(0, 12);
  return Card({
    title: "Mind",
    subtitle: "Activation health and cognition runtime",
    body: `
      <div class="yx-kv"><b>Status:</b> ${state.health.mind.active ? "active" : "idle"}</div>
      <div class="yx-kv"><b>Last activation:</b> ${state.health.mind.lastActivationTs ? new Date(state.health.mind.lastActivationTs).toLocaleString() : "never"}</div>
      <div class="yx-kv"><b>Graph nodes:</b> ${Object.keys(state.mind.nodes || {}).length}</div>
      <div class="yx-kv"><b>Graph edges:</b> ${Object.keys(state.mind.edges || {}).length}</div>
      <div class="yx-kv"><b>Recent activations:</b></div>
      <div class="yx-list-compact">
        ${recent.length ? recent.map((x) => `<button data-kind="activations" data-activation-id="${escapeAttr(x.id)}">${new Date(x.ts_ms).toLocaleTimeString()} · ${escapeHtml(x.label || x.id || "node")}</button>`).join("") : '<div class="yx-empty">No activations</div>'}
      </div>
      <div class="yx-muted">Open the Graph tab for topology and node inspector.</div>
    `,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
