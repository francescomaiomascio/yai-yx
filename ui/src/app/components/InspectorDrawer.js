export function InspectorDrawer({ inspector }) {
  if (!inspector.open || !inspector.item) return "";
  return `
    <aside class="yx-drawer yx-drawer--open" id="yx-inspector-drawer">
      <header class="yx-drawer__header">
        <h3>${inspector.title || "Inspector"}</h3>
        <button id="yx-inspector-close">Close</button>
      </header>
      <div class="yx-drawer__section">
        <h4>Structured</h4>
        <dl>
          <dt>Topic</dt><dd>${inspector.item.topic || "-"}</dd>
          <dt>Severity</dt><dd>${inspector.item.severity || "-"}</dd>
          <dt>Trace</dt><dd>${inspector.item.trace_id || inspector.item.request?.trace_id || "-"}</dd>
          <dt>Time</dt><dd>${new Date(inspector.item.ts_ms || Date.now()).toLocaleString()}</dd>
          <dt>Summary</dt><dd>${inspector.item.summary || "-"}</dd>
        </dl>
      </div>
      ${inspector.item.request ? `<div class="yx-drawer__section"><h4>Request</h4><pre>${escapeHtml(JSON.stringify(inspector.item.request, null, 2))}</pre></div>` : ""}
      ${inspector.item.response ? `<div class="yx-drawer__section"><h4>Response</h4><pre>${escapeHtml(JSON.stringify(inspector.item.response, null, 2))}</pre></div>` : ""}
      ${inspector.item.error ? `<div class="yx-drawer__section"><h4>Error</h4><pre>${escapeHtml(JSON.stringify(inspector.item.error, null, 2))}</pre></div>` : ""}
      <div class="yx-drawer__section">
        <h4>Raw JSON</h4>
        <pre>${escapeHtml(JSON.stringify(inspector.item.raw || inspector.item, null, 2))}</pre>
      </div>
    </aside>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
