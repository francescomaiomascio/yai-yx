export function GraphView(state) {
  const nodes = Object.values(state.mind.nodes || {});
  const edges = Object.values(state.mind.edges || {});
  const activations = (state.mind.activations || []).slice(0, 30);
  const layout = computeLayout(nodes, edges, 720, 320);

  return `
    <section class="yx-graph-view">
      <div class="yx-card">
        <header class="yx-card__header">
          <h3>Mind Graph</h3>
          <p>Force-directed graph + activation stream</p>
        </header>
        <div class="yx-card__body">
          <div class="yx-graph-summary">
            <div><b>Nodes:</b> ${nodes.length}</div>
            <div><b>Edges:</b> ${edges.length}</div>
            <div><b>Active set:</b> ${activations.length}</div>
          </div>
          <svg class="yx-mind-graph" viewBox="0 0 720 320" preserveAspectRatio="xMidYMid meet">
            ${renderEdges(edges, layout)}
            ${renderNodes(nodes, layout)}
          </svg>
        </div>
      </div>

      <div class="yx-card">
        <header class="yx-card__header">
          <h3>Activation Stream</h3>
          <p>Latest mind.graph.activation events</p>
        </header>
        <div class="yx-card__body">
          ${
            activations.length
              ? `<div class="yx-table">${activations
                  .map(
                    (a, idx) => `<button class="yx-table__row" data-kind="activations" data-idx="${idx}">
                  <span>${new Date(a.ts_ms).toLocaleTimeString()}</span>
                  <span>${Math.round((a.score || 0) * 100)}%</span>
                  <span>${escapeHtml(a.id || "-")}</span>
                  <span>${escapeHtml(a.label || "-")}</span>
                </button>`,
                  )
                  .join("")}</div>`
              : '<div class="yx-empty">No activation data yet</div>'
          }
        </div>
      </div>
    </section>
  `;
}

function renderEdges(edges, layout) {
  return edges
    .map((edge) => {
      const a = layout[edge.source];
      const b = layout[edge.target];
      if (!a || !b) return "";
      const w = Math.min(4, 1 + (edge.weight || 1) * 0.2);
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="rgba(73,120,158,.45)" stroke-width="${w.toFixed(1)}" />`;
    })
    .join("");
}

function renderNodes(nodes, layout) {
  return nodes
    .map((node) => {
      const p = layout[node.id];
      if (!p) return "";
      const r = Math.max(5, Math.min(14, 5 + (node.hits || 0) * 0.35));
      return `<g>
        <circle cx="${p.x}" cy="${p.y}" r="${r.toFixed(1)}" fill="rgba(52,152,219,.88)" stroke="rgba(211,235,255,.45)" data-graph-node="${escapeAttr(node.id)}" />
        <text x="${(p.x + r + 3).toFixed(1)}" y="${(p.y + 4).toFixed(1)}" font-size="10" fill="rgba(194,210,224,.92)">${escapeXml((node.label || node.id || "node").slice(0, 20))}</text>
      </g>`;
    })
    .join("");
}

function computeLayout(nodes, edges, width, height) {
  if (!nodes.length) return {};
  const layout = {};
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const area = width * height;
  const k = Math.sqrt(area / nodes.length);

  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    layout[node.id] = {
      x: width / 2 + Math.cos(angle) * Math.min(width, height) * 0.25,
      y: height / 2 + Math.sin(angle) * Math.min(width, height) * 0.25,
      dx: 0,
      dy: 0,
    };
  });

  for (let iter = 0; iter < 24; iter += 1) {
    for (const a of nodes) {
      const pa = layout[a.id];
      pa.dx = 0;
      pa.dy = 0;
      for (const b of nodes) {
        if (a.id === b.id) continue;
        const pb = layout[b.id];
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        dx /= dist;
        dy /= dist;
        pa.dx += dx * force;
        pa.dy += dy * force;
      }
    }

    for (const e of edges) {
      const source = layout[e.source];
      const target = layout[e.target];
      if (!source || !target) continue;
      let dx = source.x - target.x;
      let dy = source.y - target.y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      dx /= dist;
      dy /= dist;
      source.dx -= dx * force;
      source.dy -= dy * force;
      target.dx += dx * force;
      target.dy += dy * force;
    }

    for (const node of nodes) {
      const p = layout[node.id];
      p.x = clamp(p.x + p.dx * 0.006, 18, width - 18);
      p.y = clamp(p.y + p.dy * 0.006, 18, height - 18);
    }
  }

  for (const id of Object.keys(layout)) {
    delete layout[id].dx;
    delete layout[id].dy;
    if (!byId.has(id)) delete layout[id];
  }

  return layout;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function escapeXml(value) {
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
