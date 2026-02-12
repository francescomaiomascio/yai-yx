export function CommandPalette({
  open,
  query = "",
  categories = [],
  selectedCategory = "all",
  commands = [],
  selectedCommand = null,
  selectedArgs = {},
  recents = [],
  pinned = [],
  useJson = false,
  jsonDraft = "{}",
}) {
  if (!open) return "";

  return `
    <div class="yx-command-center" id="yx-command-center">
      <div class="yx-command-center__panel">
        <header class="yx-command-center__header">
          <h3>Command Center</h3>
          <button id="yx-command-center-close">Close</button>
        </header>

        <div class="yx-command-center__search">
          <input id="yx-command-input" value="${escapeAttr(query)}" placeholder="Search commands (Ctrl+K)" />
          <div class="yx-command-center__categories">
            ${["all", ...categories]
              .map(
                (cat) => `<button class="${cat === selectedCategory ? "active" : ""}" data-cc-category="${cat}">${cat}</button>`,
              )
              .join("")}
          </div>
        </div>

        <div class="yx-command-center__body">
          <aside class="yx-command-center__list">
            ${commands.length
              ? commands
                  .map(
                    (cmd) => `<button class="yx-cc-row ${selectedCommand?.id === cmd.id ? "active" : ""}" data-cmd="${cmd.id}">
                      <span class="yx-cc-row__id">${cmd.id}</span>
                      <span class="yx-cc-row__meta">${cmd.category}</span>
                      <span class="yx-cc-row__desc">${escapeHtml(cmd.description)}</span>
                    </button>`,
                  )
                  .join("")
              : '<div class="yx-empty">No matching commands</div>'}
          </aside>

          <section class="yx-command-center__run">
            ${selectedCommand ? renderRunPanel(selectedCommand, selectedArgs, useJson, jsonDraft) : '<div class="yx-empty">Select a command</div>'}
            <div class="yx-command-center__meta-panels">
              ${renderSimpleList("Pinned", pinned)}
              ${renderSimpleList("Recents", recents)}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderRunPanel(cmd, args, useJson, jsonDraft) {
  const schema = cmd.args || [];
  return `
    <div class="yx-cc-run-card">
      <h4>${cmd.id}</h4>
      <p>${escapeHtml(cmd.description)}</p>
      <div class="yx-cc-run-actions">
        <button id="yx-cc-toggle-json">${useJson ? "Use Form" : "Use JSON"}</button>
        <button id="yx-cc-pin">${cmd.pinned ? "Unpin" : "Pin"}</button>
      </div>
      ${
        useJson
          ? `<textarea id="yx-cc-json" rows="8">${escapeHtml(jsonDraft)}</textarea>`
          : `<div class="yx-cc-args">${schema
              .map(
                (f) => `<label>
                  <span>${f.key}${f.required ? " *" : ""}</span>
                  <input data-cc-arg="${f.key}" value="${escapeAttr(args[f.key] ?? f.default ?? "")}" placeholder="${escapeAttr(f.placeholder || f.type || "value")}" />
                </label>`,
              )
              .join("") || '<div class="yx-muted">No args required</div>'}</div>`
      }
      <button id="yx-cc-run" class="yx-cc-run-btn">Run</button>
    </div>
  `;
}

function renderSimpleList(title, items) {
  return `
    <div class="yx-cc-meta-card">
      <h5>${title}</h5>
      <div class="yx-cc-meta-list">
        ${items.length ? items.map((x) => `<button data-cmd="${escapeAttr(x)}">${escapeHtml(x)}</button>`).join("") : '<div class="yx-empty">None</div>'}
      </div>
    </div>
  `;
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
