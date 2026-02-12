export function ShellView(state) {
  const entries = (state.shell.entries || []).slice(0, 120);
  return `
    <section class="yx-shell-view">
      <div class="yx-terminal">
        <div class="yx-terminal__header">
          <span>Operator Shell</span>
          <div class="yx-terminal__controls">
            <button id="yx-shell-copy">Copy output</button>
            <button id="yx-shell-rerun">Re-run last</button>
            <button id="yx-shell-clear">Clear</button>
          </div>
        </div>
        <div class="yx-terminal__body" id="yx-shell-terminal-body">
          ${entries.length
            ? entries
                .map(
                  (e) => `
                <div class="yx-terminal__entry">
                  <div class="yx-terminal__prompt">$ ${escapeHtml(e.command || "")}</div>
                  ${e.stdout ? `<pre class="yx-terminal__stdout">${escapeHtml(e.stdout)}</pre>` : ""}
                  ${e.stderr ? `<pre class="yx-terminal__stderr">${escapeHtml(e.stderr)}</pre>` : ""}
                  ${!e.stdout && !e.stderr ? `<pre class="yx-terminal__stdout">(exit ${e.exit_code ?? 0})</pre>` : ""}
                </div>
              `,
                )
                .join("")
            : '<div class="yx-empty">No commands executed yet</div>'}
        </div>
        <div class="yx-terminal__input">
          <span class="yx-terminal__prompt-symbol">$</span>
          <input id="yx-shell-input" placeholder="echo hello" autocomplete="off" />
          <button id="yx-shell-run">Run</button>
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
