import { Badge } from "./components/Badge.js";
import { CommandPalette } from "./components/CommandPalette.js";
import { InspectorDrawer } from "./components/InspectorDrawer.js";
import { OverviewView } from "./views/Overview.js";
import { EventsView } from "./views/Events.js";
import { LogsView } from "./views/Logs.js";
import { LawView } from "./views/Law.js";
import { MindView } from "./views/Mind.js";
import { GraphView } from "./views/Graph.js";
import { ChatView } from "./views/Chat.js";
import { ShellView } from "./views/Shell.js";
import { ProvidersView } from "./views/Providers.js";
import {
  clearFeeds,
  clearShellTranscript,
  closeInspector,
  notify,
  openInspector,
  setCommandHistoryOpen,
  setNavCollapsed,
  setRoute,
  setToast,
  state,
  subscribe,
} from "./state/store.js";
import { connectAndSubscribe, reconnect, selectWorkspace } from "./api/bridge.js";
import { runCommand } from "./state/commands.js";
import { refreshChatHistory, refreshChatSessions, sendChat } from "./state/chat.js";
import { runShellCommand } from "./state/shell.js";
import {
  providersAttach,
  providersDetach,
  providersDiscover,
  providersList,
  providersPair,
  providersRevoke,
  providersStatus,
} from "./state/providers.js";

const NAV = ["overview", "events", "logs", "law", "providers", "mind", "graph", "chat", "shell"];

const COMMAND_REGISTRY = [
  { id: "status", category: "Control", description: "Control plane status", args: [] },
  { id: "events.subscribe", category: "Control", description: "Subscribe events stream", args: [] },
  { id: "law.snapshot", category: "Law", description: "Law snapshot", args: [] },
  {
    id: "providers.discover",
    category: "Providers",
    description: "Discover providers",
    args: [
      { key: "endpoint", type: "string", required: false, placeholder: "http://127.0.0.1:18080/v1/chat/completions" },
      { key: "model", type: "string", required: false, placeholder: "qwen-test" },
    ],
  },
  { id: "providers.list", category: "Providers", description: "List providers", args: [] },
  { id: "providers.status", category: "Providers", description: "Active provider status", args: [] },
  { id: "mind.graph.activation.tail", category: "Mind", description: "Tail activation stream", args: [] },
  {
    id: "chat.send",
    category: "Chat",
    description: "Send message",
    args: [
      { key: "text", type: "string", required: true, placeholder: "message" },
      { key: "stream", type: "boolean", required: false, placeholder: "true" },
    ],
  },
  {
    id: "shell.exec",
    category: "Shell",
    description: "Run shell command",
    args: [
      { key: "cmd", type: "string", required: true, placeholder: "echo" },
      { key: "args", type: "string[]", required: false, placeholder: "ok" },
    ],
  },
];

let commandCenterOpen = false;
let commandQuery = "";
let selectedCategory = "all";
let selectedCommandId = "status";
let selectedArgs = {};
let commandUseJson = false;
let commandJsonDraft = "{}";
let pinnedCommands = ["status", "providers.status"];
let shellHistoryCursor = -1;

let eventsFilter = { text: "", topic: "", severity: "all" };
let logsFilter = { text: "", topic: "", severity: "all" };

export function mountApp(root) {
  if (!root) return;

  subscribe(() => render(root));
  bindGlobalKeys(root);

  connectAndSubscribe().then(async () => {
    await Promise.all([
      refreshChatSessions().catch(() => {}),
      refreshChatHistory().catch(() => {}),
      providersList().catch(() => {}),
      providersStatus().catch(() => {}),
    ]);
    notify();
  });

  render(root);
}

function render(root) {
  const connectedRecent = isConnectedRecent(state.connection);
  const connTone = connectedRecent ? "ok" : "deny";
  const connText = connectedRecent ? "CONNECTED" : "OFFLINE";
  const selectedCommand = getSelectedCommand();
  const filtered = filterCommands();

  root.innerHTML = `
    <div class="yx-shell ${state.navCollapsed ? "yx-shell--nav-collapsed" : ""}">
      <aside class="yx-sidebar">
        <div class="yx-sidebar__head">
          <h1>YX</h1>
          <button id="yx-nav-toggle">${state.navCollapsed ? "»" : "«"}</button>
        </div>
        <nav class="yx-nav">
          ${NAV.map((id) => `<button data-nav="${id}" class="${state.route === id ? "active" : ""}">${cap(id)}</button>`).join("")}
        </nav>
      </aside>

      <main class="yx-main">
        <header class="yx-topbar">
          <div class="yx-topbar__left"><strong>YX (YAI Experience)</strong></div>
          <div class="yx-topbar__center">
            ${Badge({ text: connText, tone: connTone })}
            ${Badge({ text: state.runtimeMode, tone: modeTone(state.runtimeMode) })}
          </div>
          <div class="yx-topbar__right">
            <select id="yx-ws-select" title="Workspace">
              ${renderWorkspaceOptions()}
            </select>
            <span class="yx-socket" title="${state.connection.socket_path || "(none)"}">${truncatePath(state.connection.socket_path || "(none)")}</span>
            <span class="yx-latency">${state.connection.latency_ms != null ? `${state.connection.latency_ms}ms` : "--"}</span>
            <button id="yx-reconnect">Reconnect</button>
            <button id="yx-refresh">Refresh</button>
            <button id="yx-clear-feed">Clear Feed</button>
            <button id="yx-open-history">History</button>
            <button id="yx-open-command-center">Command Center</button>
            <span class="yx-muted">Ctrl+K</span>
          </div>
        </header>

        <section class="yx-content">
          ${renderActiveView()}
        </section>
      </main>
    </div>

    ${renderHistoryDrawer()}
    ${state.toast ? `<div class="yx-toast yx-toast--${state.toast.tone || "info"}">${escapeHtml(state.toast.message || "")}</div>` : ""}
    ${InspectorDrawer({ inspector: state.inspector })}
    ${CommandPalette({
      open: commandCenterOpen,
      query: commandQuery,
      categories: uniqueCategories(),
      selectedCategory,
      commands: filtered,
      selectedCommand,
      selectedArgs,
      recents: recentCommands(),
      pinned: pinnedCommands,
      useJson: commandUseJson,
      jsonDraft: commandJsonDraft,
    })}
  `;

  bindUiActions(root);
}

function renderWorkspaceOptions() {
  const items = state.workspaces.items || [];
  const selected = state.workspaces.selected_ws || state.connection.selected_ws || "dev";
  if (!items.length) {
    return `<option value="${selected}" selected>${selected}</option>`;
  }
  return items
    .map((w) => `<option value="${w.ws}" ${w.ws === selected ? "selected" : ""}>${w.ws}${w.alive ? " (alive)" : ""}</option>`)
    .join("");
}

function renderActiveView() {
  if (state.route === "overview") return OverviewView(state);
  if (state.route === "events") return EventsView({ ...state, events: filterRows(state.events, eventsFilter) });
  if (state.route === "logs") return LogsView({ ...state, logs: filterRows(state.logs, logsFilter) });
  if (state.route === "law") return LawView(state);
  if (state.route === "providers") return ProvidersView(state);
  if (state.route === "mind") return MindView(state);
  if (state.route === "graph") return GraphView(state);
  if (state.route === "chat") return ChatView(state);
  return ShellView(state);
}

function renderHistoryDrawer() {
  const items = state.commandHistory.slice(0, 80);
  return `
    <aside class="yx-history-drawer ${state.commandHistoryOpen ? "yx-history-drawer--open" : ""}" id="yx-history-drawer">
      <header>
        <h3>Command History</h3>
        <button id="yx-history-close">Close</button>
      </header>
      <div class="yx-history-drawer__body">
        ${items.length
          ? items
              .map(
                (x) => `<button class="yx-history-row" data-history='${escapeAttr(JSON.stringify(x))}'>
                  <span><b>${x.name}</b></span>
                  <span>${new Date(x.ts_ms).toLocaleTimeString()}</span>
                  <span>${x.ok ? "ok" : "error"}</span>
                  <span class="yx-muted">${escapeHtml(x.trace_id || "-")}</span>
                </button>`,
              )
              .join("")
          : '<div class="yx-empty">No commands yet</div>'}
      </div>
    </aside>
  `;
}

function bindUiActions(root) {
  root.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => setRoute(el.getAttribute("data-nav")));
  });
  root.querySelectorAll("[data-nav-target]").forEach((el) => {
    el.addEventListener("click", () => setRoute(el.getAttribute("data-nav-target") || "overview"));
  });

  root.querySelectorAll("[data-history]").forEach((el) => {
    el.addEventListener("click", () => {
      const payload = JSON.parse(el.getAttribute("data-history") || "{}");
      inspectCommand(payload);
    });
  });

  root.querySelectorAll("[data-history-trace]").forEach((el) => {
    el.addEventListener("click", () => {
      const trace = el.getAttribute("data-history-trace");
      const row = (state.commandHistory || []).find((x) => (x.trace_id || "") === trace);
      if (row) inspectCommand(row);
      setCommandHistoryOpen(true);
    });
  });

  bindFeedRows(root);

  root.querySelector("#yx-nav-toggle")?.addEventListener("click", () => {
    setNavCollapsed(!state.navCollapsed);
  });

  root.querySelector("#yx-open-command-center")?.addEventListener("click", () => {
    commandCenterOpen = true;
    notify();
  });

  root.querySelector("#yx-command-center-close")?.addEventListener("click", () => {
    commandCenterOpen = false;
    notify();
  });

  root.querySelector("#yx-open-history")?.addEventListener("click", () => {
    setCommandHistoryOpen(!state.commandHistoryOpen);
  });

  root.querySelector("#yx-history-close")?.addEventListener("click", () => {
    setCommandHistoryOpen(false);
  });

  root.querySelector("#yx-ws-select")?.addEventListener("change", async (e) => {
    const ws = e.target.value;
    await selectWorkspace(ws);
    await reconnect();
    await providersStatus().catch(() => {});
  });

  root.querySelector("#yx-reconnect")?.addEventListener("click", async () => {
    await reconnect();
  });

  root.querySelector("#yx-refresh")?.addEventListener("click", async () => {
    await Promise.all([
      reconnect(),
      runCommand("status", {}).catch(() => {}),
      providersList().catch(() => {}),
      providersStatus().catch(() => {}),
    ]);
  });

  root.querySelector("#yx-clear-feed")?.addEventListener("click", () => clearFeeds());
  root.querySelector("#yx-inspector-close")?.addEventListener("click", () => closeInspector());

  bindChatActions(root);
  bindShellActions(root);
  bindProviderActions(root);
  bindFilters(root);
  bindCommandCenter(root);
  bindGraphInteractions(root);

  if (state.toast && Date.now() - (state.toast.ts_ms || 0) > 3500) {
    setToast(null);
  }
}

function bindChatActions(root) {
  root.querySelector("#yx-overview-chat-send")?.addEventListener("click", async () => {
    const input = root.querySelector("#yx-overview-chat-input");
    await sendChat(input?.value || "").catch(() => {});
    if (input) input.value = "";
  });

  root.querySelector("#yx-chat-send")?.addEventListener("click", async () => {
    const input = root.querySelector("#yx-chat-input");
    await sendChat(input?.value || "").catch(() => {});
    if (input) input.value = "";
  });
}

function bindShellActions(root) {
  root.querySelector("#yx-overview-shell-run")?.addEventListener("click", async () => {
    const input = root.querySelector("#yx-overview-shell-input");
    await runShellCommand(input?.value || "").catch(() => {});
    if (input) input.value = "";
  });

  const shellInput = root.querySelector("#yx-shell-input");
  root.querySelector("#yx-shell-run")?.addEventListener("click", async () => {
    await runShellCommand(shellInput?.value || "").catch(() => {});
    shellHistoryCursor = -1;
    if (shellInput) shellInput.value = "";
  });

  root.querySelector("#yx-shell-rerun")?.addEventListener("click", async () => {
    const first = state.shell.entries[0];
    if (first?.command) await runShellCommand(first.command).catch(() => {});
  });

  root.querySelector("#yx-shell-clear")?.addEventListener("click", () => {
    clearShellTranscript();
  });

  root.querySelector("#yx-shell-copy")?.addEventListener("click", async () => {
    const text = state.shell.lastOutput || "";
    if (navigator.clipboard && text) await navigator.clipboard.writeText(text).catch(() => {});
  });

  shellInput?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      await runShellCommand(shellInput.value || "").catch(() => {});
      shellHistoryCursor = -1;
      shellInput.value = "";
      return;
    }
    const history = state.shell.commandHistory || [];
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      clearShellTranscript();
      return;
    }
    if (e.key === "ArrowUp" && history.length) {
      e.preventDefault();
      shellHistoryCursor = Math.min(shellHistoryCursor + 1, history.length - 1);
      shellInput.value = history[shellHistoryCursor] || "";
    }
    if (e.key === "ArrowDown" && history.length) {
      e.preventDefault();
      shellHistoryCursor = Math.max(shellHistoryCursor - 1, -1);
      shellInput.value = shellHistoryCursor >= 0 ? history[shellHistoryCursor] : "";
    }
  });
}

function bindProviderActions(root) {
  const id = () => root.querySelector("#yx-prov-id")?.value?.trim() || "";
  const endpoint = () => root.querySelector("#yx-prov-endpoint")?.value?.trim() || "";
  const model = () => root.querySelector("#yx-prov-model")?.value?.trim() || "";

  root.querySelector("#yx-prov-discover")?.addEventListener("click", async () => {
    await providersDiscover(endpoint() || null, model() || null).catch(() => {});
  });
  root.querySelector("#yx-prov-list")?.addEventListener("click", async () => {
    await providersList().catch(() => {});
  });
  root.querySelector("#yx-prov-status")?.addEventListener("click", async () => {
    await providersStatus().catch(() => {});
  });
  root.querySelector("#yx-prov-detach")?.addEventListener("click", async () => {
    await providersDetach().catch(() => {});
  });
  root.querySelector("#yx-prov-pair")?.addEventListener("click", async () => {
    if (!id() || !endpoint() || !model()) return;
    await providersPair(id(), endpoint(), model()).catch(() => {});
  });
  root.querySelector("#yx-prov-attach")?.addEventListener("click", async () => {
    if (!id()) return;
    await providersAttach(id(), model() || null).catch(() => {});
  });
  root.querySelector("#yx-prov-revoke")?.addEventListener("click", async () => {
    if (!id()) return;
    await providersRevoke(id()).catch(() => {});
  });
}

function bindFilters(root) {
  root.querySelector("#yx-events-filter-text")?.addEventListener("input", (e) => {
    eventsFilter.text = e.target.value || "";
    notify();
  });
  root.querySelector("#yx-events-filter-topic")?.addEventListener("input", (e) => {
    eventsFilter.topic = e.target.value || "";
    notify();
  });
  root.querySelector("#yx-events-filter-severity")?.addEventListener("change", (e) => {
    eventsFilter.severity = e.target.value || "all";
    notify();
  });
  root.querySelector("#yx-logs-filter-text")?.addEventListener("input", (e) => {
    logsFilter.text = e.target.value || "";
    notify();
  });
  root.querySelector("#yx-logs-filter-topic")?.addEventListener("input", (e) => {
    logsFilter.topic = e.target.value || "";
    notify();
  });
  root.querySelector("#yx-logs-filter-severity")?.addEventListener("change", (e) => {
    logsFilter.severity = e.target.value || "all";
    notify();
  });
}

function bindCommandCenter(root) {
  root.querySelector("#yx-command-input")?.addEventListener("input", (e) => {
    commandQuery = e.target.value || "";
    notify();
  });

  root.querySelectorAll("[data-cc-category]").forEach((el) => {
    el.addEventListener("click", () => {
      selectedCategory = el.getAttribute("data-cc-category") || "all";
      notify();
    });
  });

  root.querySelectorAll(".yx-cc-row,[data-cmd]").forEach((el) => {
    el.addEventListener("click", () => {
      const cmd = el.getAttribute("data-cmd");
      if (!cmd) return;
      selectedCommandId = cmd;
      commandJsonDraft = "{}";
      selectedArgs = {};
      notify();
    });
  });

  root.querySelector("#yx-cc-toggle-json")?.addEventListener("click", () => {
    commandUseJson = !commandUseJson;
    notify();
  });

  root.querySelector("#yx-cc-pin")?.addEventListener("click", () => {
    if (pinnedCommands.includes(selectedCommandId)) {
      pinnedCommands = pinnedCommands.filter((x) => x !== selectedCommandId);
    } else {
      pinnedCommands = [selectedCommandId, ...pinnedCommands].slice(0, 12);
    }
    notify();
  });

  root.querySelector("#yx-cc-json")?.addEventListener("input", (e) => {
    commandJsonDraft = e.target.value || "{}";
  });

  root.querySelectorAll("[data-cc-arg]").forEach((el) => {
    el.addEventListener("input", () => {
      const key = el.getAttribute("data-cc-arg");
      selectedArgs[key] = el.value;
    });
  });

  root.querySelector("#yx-cc-run")?.addEventListener("click", async () => {
    await runSelectedCommand().catch(() => {});
  });
}

function bindGraphInteractions(root) {
  root.querySelectorAll("[data-graph-node]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-graph-node");
      if (!id) return;
      const node = state.mind.nodes[id];
      const neighbors = Object.values(state.mind.edges || {})
        .filter((e) => e.source === id || e.target === id)
        .map((e) => (e.source === id ? e.target : e.source));
      const activations = (state.mind.activations || []).filter((a) => a.id === id).slice(0, 8);
      openInspector("Graph Node", {
        topic: "mind.graph.node",
        severity: "info",
        ts_ms: node?.last_ts_ms || Date.now(),
        summary: node?.label || id,
        raw: { node, neighbors, activations },
      });
    });
  });

  root.querySelectorAll("[data-activation-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-activation-id");
      const act = (state.mind.activations || []).find((a) => a.id === id);
      if (act) {
        openInspector("Activation", {
          topic: "mind.graph.activation",
          severity: "info",
          ts_ms: act.ts_ms,
          summary: act.label || act.id,
          raw: act,
        });
      }
    });
  });
}

async function runSelectedCommand() {
  const cmd = getSelectedCommand();
  if (!cmd) return;
  const args = commandUseJson ? parseJsonArgs() : collectFormArgs();

  if (cmd.id === "chat.send") {
    await sendChat(String(args.text || "")).catch(() => {});
  } else if (cmd.id === "shell.exec") {
    const command = String(args.cmd || "").trim();
    const arr = parseArgsArray(args.args);
    if (!command) return;
    await runShellCommand([command, ...arr].join(" ")).catch(() => {});
  } else {
    await runCommand(cmd.id, args).catch(() => {});
  }

  commandCenterOpen = false;
  notify();
}

function parseJsonArgs() {
  try {
    const parsed = JSON.parse(commandJsonDraft || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    setToast("Invalid JSON args", "warn");
    return {};
  }
}

function collectFormArgs() {
  const cmd = getSelectedCommand();
  if (!cmd) return {};
  const out = {};
  for (const arg of cmd.args || []) {
    const raw = selectedArgs[arg.key];
    if (raw == null || raw === "") continue;
    if (arg.type === "boolean") {
      out[arg.key] = String(raw).toLowerCase() !== "false";
    } else if (arg.type === "number") {
      const n = Number(raw);
      if (!Number.isNaN(n)) out[arg.key] = n;
    } else if (arg.type === "string[]") {
      out[arg.key] = parseArgsArray(raw);
    } else {
      out[arg.key] = raw;
    }
  }
  return out;
}

function parseArgsArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function bindGlobalKeys(root) {
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      commandCenterOpen = !commandCenterOpen;
      notify();
      setTimeout(() => root.querySelector("#yx-command-input")?.focus(), 0);
    }
    if (e.key === "Escape") {
      if (commandCenterOpen) {
        commandCenterOpen = false;
        notify();
      }
    }
  });
}

function bindFeedRows(root) {
  root.querySelectorAll(".yx-feed__row,.yx-table__row").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = Number(row.getAttribute("data-idx") || 0);
      const kind = row.getAttribute("data-kind") || "events";
      const source = sourceByKind(kind);
      const item = source[idx];
      if (!item) return;
      openInspector(`${cap(kind)} Inspector`, {
        ...item,
        raw: item.raw || item,
      });
    });
  });
}

function sourceByKind(kind) {
  if (kind === "logs") return state.logs;
  if (kind === "incidents") return deriveIncidentsFromEvents(state.events || []);
  if (kind === "providers") return state.providers.items || [];
  if (kind === "activations") return state.mind.activations || [];
  return state.events;
}

function deriveIncidentsFromEvents(events) {
  const seen = new Set();
  return events
    .filter((e) => e.severity === "error" || e.severity === "warn")
    .filter((e) => {
      const key = `${e.topic}:${e.summary}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function filterRows(rows, filter) {
  const text = (filter.text || "").toLowerCase();
  const topic = (filter.topic || "").toLowerCase();
  return rows.filter((row) => {
    const sevOk = filter.severity === "all" || row.severity === filter.severity;
    const textOk = !text || `${row.topic} ${row.summary}`.toLowerCase().includes(text);
    const topicOk = !topic || String(row.topic || "").toLowerCase().includes(topic);
    return sevOk && textOk && topicOk;
  });
}

function filterCommands() {
  const q = commandQuery.trim().toLowerCase();
  return COMMAND_REGISTRY
    .filter((cmd) => selectedCategory === "all" || cmd.category.toLowerCase() === selectedCategory.toLowerCase())
    .filter((cmd) => !q || `${cmd.id} ${cmd.description} ${cmd.category}`.toLowerCase().includes(q))
    .map((cmd) => ({ ...cmd, pinned: pinnedCommands.includes(cmd.id) }));
}

function uniqueCategories() {
  return [...new Set(COMMAND_REGISTRY.map((x) => x.category.toLowerCase()))];
}

function recentCommands() {
  const out = [];
  for (const item of state.commandHistory || []) {
    if (!out.includes(item.name)) out.push(item.name);
    if (out.length >= 8) break;
  }
  return out;
}

function getSelectedCommand() {
  return COMMAND_REGISTRY.find((c) => c.id === selectedCommandId) || COMMAND_REGISTRY[0];
}

function inspectCommand(payload) {
  openInspector("Command Inspector", {
    ts_ms: payload.ts_ms,
    topic: payload.name,
    severity: payload.ok ? "info" : "error",
    summary: payload.ok ? "command ok" : payload.error?.message || "command error",
    trace_id: payload.trace_id,
    request: payload.request,
    response: payload.response,
    error: payload.error,
    raw: payload,
  });
}

function isConnectedRecent(conn) {
  if (!conn?.connected || !conn?.last_ok_ts_ms) return false;
  return Date.now() - conn.last_ok_ts_ms < 5000;
}

function truncatePath(path) {
  if (!path || path === "(none)") return "(none)";
  if (path.length <= 46) return path;
  return `${path.slice(0, 20)}...${path.slice(-22)}`;
}

function cap(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function modeTone(mode) {
  if (mode === "LOCKDOWN") return "deny";
  if (mode === "DEGRADED") return "warn";
  return "ok";
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
