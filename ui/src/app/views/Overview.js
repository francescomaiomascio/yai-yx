import { Card } from "../components/Card.js";
import { FeedList } from "../components/FeedList.js";

export function OverviewView(state) {
  const events = state.events.slice(0, 30);
  const incidents = deriveIncidents(state.events);
  const activity = deriveActivity(state.events);
  const chatLast = state.chat.messages.slice(-5);
  const connected = Boolean(state.connection.connected && state.connection.last_ok_ts_ms && Date.now() - state.connection.last_ok_ts_ms < 5000);
  const recentCommands = (state.commandHistory || []).slice(0, 5);

  return `
    <section class="yx-overview">
      <div class="yx-health-strip">
        ${healthCard("Control Plane", connected ? "CONNECTED" : "OFFLINE", state.connection.socket_path || "-", "events")}
        ${healthCard("Law", `${state.health.law.violations} violations`, formatTs(state.health.law.lastViolationTs), "law")}
        ${healthCard("Providers", `${state.health.providers.count} active`, state.health.providers.lastError || "none", "providers")}
        ${healthCard("Mind", state.health.mind.active ? "active" : "idle", formatTs(state.health.mind.lastActivationTs), "mind")}
        ${healthCard("Engine", state.health.engine.state || "unknown", "runtime", "logs")}
        ${healthCard("Kernel", state.health.kernel.state || "unknown", "authority", "logs")}
      </div>

      <div class="yx-overview-grid">
        ${Card({ title: "Incidents", subtitle: "Latest actionable errors/warnings", body: FeedList({ id: "yx-incidents-feed", items: incidents, kind: "incidents", emptyText: "No active incidents" }) })}
        ${Card({
          title: "Activity",
          subtitle: `${activity.ratePerMin} events/min`,
          body: `
            <div class="yx-activity-topics">
              ${activity.topics.map((x) => `<button data-nav-target="events">${escapeHtml(x.topic)} <b>${x.count}</b></button>`).join("") || '<div class="yx-empty">No activity yet</div>'}
            </div>
          `,
        })}
      </div>

      <div class="yx-overview-grid">
        ${Card({
          title: "Live Events",
          subtitle: "Last 30",
          body: FeedList({ id: "yx-events-feed", items: events, kind: "events" }),
        })}
        ${Card({
          title: "Chat Quick",
          subtitle: "Last 5 messages",
          body: `
            <div class="yx-chat-mini">
              <div class="yx-chat-mini__list">${chatLast.map((m) => `<div><b>${m.role}</b>: ${escapeHtml(m.content)}</div>`).join("") || '<div class="yx-empty">No messages</div>'}</div>
              <div class="yx-input-row">
                <input id="yx-overview-chat-input" placeholder="Send message" />
                <button id="yx-overview-chat-send">Send</button>
              </div>
            </div>
          `,
        })}
      </div>

      <div class="yx-overview-grid">
        ${Card({
          title: "Shell Quick",
          subtitle: "Run single command",
          body: `
            <div class="yx-shell-mini">
              <div class="yx-input-row">
                <input id="yx-overview-shell-input" placeholder="echo ok" />
                <button id="yx-overview-shell-run">Run</button>
              </div>
              <pre class="yx-shell-mini__preview">${escapeHtml((state.shell.lastOutput || "").split("\n").slice(0, 6).join("\n")) || "No output"}</pre>
              <button data-nav="shell" class="yx-link-btn">Open Shell view</button>
            </div>
          `,
        })}
        ${Card({
          title: "Graph Quick",
          subtitle: `${Object.keys(state.mind.nodes || {}).length} nodes`,
          body: `
            <div class="yx-kv"><b>Edges:</b> ${Object.keys(state.mind.edges || {}).length}</div>
            <div class="yx-kv"><b>Activations:</b> ${(state.mind.activations || []).length}</div>
            <button data-nav="graph" class="yx-link-btn">Open Graph view</button>
          `,
        })}
      </div>

      <div class="yx-overview-footer-strip">
        <span class="yx-muted">Last Commands:</span>
        ${recentCommands.length ? recentCommands.map((c) => `<button data-history-trace="${escapeAttr(c.trace_id || "")}">${escapeHtml(c.name)}</button>`).join("") : '<span class="yx-muted">none</span>'}
      </div>
    </section>
  `;
}

function healthCard(title, value, meta, navTarget) {
  return `
    <button class="yx-health-card" data-nav-target="${navTarget || "overview"}">
      <div class="yx-health-card__title">${title}</div>
      <div class="yx-health-card__value">${value}</div>
      <div class="yx-health-card__meta">${meta || "-"}</div>
    </button>
  `;
}

function deriveIncidents(events) {
  const seen = new Set();
  return (events || [])
    .filter((e) => e.severity === "error" || e.severity === "warn")
    .filter((e) => {
      const key = `${e.topic}:${e.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 16);
}

function deriveActivity(events) {
  const now = Date.now();
  const recent = (events || []).filter((e) => now - (e.ts_ms || now) <= 60_000);
  const countByTopic = new Map();
  for (const e of recent) {
    countByTopic.set(e.topic, (countByTopic.get(e.topic) || 0) + 1);
  }
  const topics = Array.from(countByTopic.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic, count]) => ({ topic, count }));

  return {
    ratePerMin: recent.length,
    topics,
  };
}

function formatTs(ts) {
  if (!ts) return "never";
  return new Date(ts).toLocaleTimeString();
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
