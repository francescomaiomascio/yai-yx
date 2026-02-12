export function ProvidersView(state) {
  const items = state.providers.items || [];
  const active = state.providers.active;

  return `
    <section class="yx-providers">
      <div class="yx-card">
        <header class="yx-card__header">
          <h3>Providers Lifecycle Console</h3>
          <p>Discover, pair, attach, detach, revoke with result/event trail</p>
        </header>
        <div class="yx-card__body yx-providers__actions">
          <button id="yx-prov-discover">Discover</button>
          <button id="yx-prov-list">List</button>
          <button id="yx-prov-status">Status</button>
          <button id="yx-prov-detach">Detach</button>
        </div>
      </div>

      <div class="yx-card">
        <header class="yx-card__header"><h3>Pair / Attach / Revoke</h3></header>
        <div class="yx-card__body yx-providers__forms">
          <div class="yx-input-grid">
            <input id="yx-prov-id" placeholder="provider id" />
            <input id="yx-prov-endpoint" placeholder="endpoint" />
            <input id="yx-prov-model" placeholder="model" />
          </div>
          <div class="yx-providers__actions">
            <button id="yx-prov-pair">Pair</button>
            <button id="yx-prov-attach">Attach</button>
            <button id="yx-prov-revoke">Revoke</button>
          </div>
        </div>
      </div>

      <div class="yx-card">
        <header class="yx-card__header"><h3>Active Provider</h3></header>
        <div class="yx-card__body">
          ${
            active
              ? `<div><b>${escapeHtml(active.id || "-")}</b> · ${escapeHtml(active.model || "-")} · ${escapeHtml(active.endpoint || "-")}</div>`
              : '<div class="yx-empty">No active provider</div>'
          }
        </div>
      </div>

      <div class="yx-card">
        <header class="yx-card__header"><h3>Providers State</h3></header>
        <div class="yx-card__body">
          ${
            items.length
              ? `<div class="yx-table">
                <div class="yx-table__head yx-table__head--providers">
                  <span>ID</span><span>State</span><span>Model</span><span>Endpoint</span><span>Last Error</span><span>Last Seen</span>
                </div>
                ${items
                  .map(
                    (p, idx) => `
                  <button class="yx-table__row yx-table__row--providers" data-kind="providers" data-idx="${idx}">
                    <span>${escapeHtml(p.id || "-")}</span>
                    <span>${escapeHtml((p.trust_state || p.state || "unknown").toString())}</span>
                    <span>${escapeHtml(p.model || "-")}</span>
                    <span>${escapeHtml(p.endpoint || "-")}</span>
                    <span>${escapeHtml(p.last_error || "-")}</span>
                    <span>${escapeHtml(String(p.last_seen || p.updated_at || "-"))}</span>
                  </button>
                `,
                  )
                  .join("")}
              </div>`
              : '<div class="yx-empty">No providers</div>'
          }
          ${state.providers.lastError ? `<div class="yx-error">${escapeHtml(state.providers.lastError)}</div>` : ""}
        </div>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
