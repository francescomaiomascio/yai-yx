const MAX_EVENTS = 300;
const MAX_LOGS = 500;
const MAX_CMD_HISTORY = 120;

export const state = {
  route: "overview",
  navCollapsed: true,
  commandHistoryOpen: false,
  connection: {
    connected: false,
    configured_mode: "auto",
    resolved_mode: "real",
    selected_ws: "dev",
    socket_path: "(none)",
    latency_ms: null,
    last_ok_ts_ms: null,
  },
  workspaces: {
    selected_ws: "dev",
    items: [],
  },
  runtimeMode: "DEGRADED",
  events: [],
  logs: [],
  toast: null,
  chat: {
    sessions: [],
    selectedSession: null,
    messages: [],
  },
  shell: {
    entries: [],
    commandHistory: [],
    lastOutput: "",
  },
  providers: {
    items: [],
    active: null,
    lastError: "",
  },
  mind: {
    nodes: {},
    edges: {},
    activations: [],
  },
  health: {
    law: { violations: 0, lastViolationTs: null },
    providers: { count: 0, lastError: "none" },
    mind: { lastActivationTs: null, active: false },
    engine: { state: "unknown" },
    kernel: { state: "unknown" },
  },
  commandHistory: [],
  inspector: {
    open: false,
    title: "",
    item: null,
  },
};

const listeners = new Set();

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify() {
  for (const listener of listeners) listener(state);
}

export function setRoute(route) {
  state.route = route;
  notify();
}

export function setNavCollapsed(next) {
  state.navCollapsed = Boolean(next);
  notify();
}

export function setCommandHistoryOpen(next) {
  state.commandHistoryOpen = Boolean(next);
  notify();
}

export function setConnection(next) {
  state.connection = { ...state.connection, ...next };
  notify();
}

export function setWorkspaces(next) {
  state.workspaces = {
    selected_ws: next?.selected_ws || state.workspaces.selected_ws,
    items: Array.isArray(next?.items) ? next.items : state.workspaces.items,
  };
  notify();
}

export function setRuntimeMode(mode) {
  state.runtimeMode = mode;
  notify();
}

export function addEvent(event) {
  state.events.unshift(event);
  state.events = state.events.slice(0, MAX_EVENTS);
  notify();
}

export function addLog(log) {
  state.logs.unshift(log);
  state.logs = state.logs.slice(0, MAX_LOGS);
  notify();
}

export function clearFeeds() {
  state.events = [];
  state.logs = [];
  notify();
}

export function pushCommandHistory(item) {
  state.commandHistory.unshift(item);
  state.commandHistory = state.commandHistory.slice(0, MAX_CMD_HISTORY);
  notify();
}

export function openInspector(title, item) {
  state.inspector = { open: true, title, item };
  notify();
}

export function closeInspector() {
  state.inspector = { open: false, title: "", item: null };
  notify();
}

export function setToast(message, tone = "info") {
  if (!message) {
    state.toast = null;
    notify();
    return;
  }
  state.toast = { message, tone, ts_ms: Date.now() };
  notify();
}

export function setHealth(patch) {
  state.health = {
    ...state.health,
    ...patch,
    law: { ...state.health.law, ...(patch.law || {}) },
    providers: { ...state.health.providers, ...(patch.providers || {}) },
    mind: { ...state.health.mind, ...(patch.mind || {}) },
    engine: { ...state.health.engine, ...(patch.engine || {}) },
    kernel: { ...state.health.kernel, ...(patch.kernel || {}) },
  };
  notify();
}

export function setChatSessions(items, selected) {
  state.chat.sessions = Array.isArray(items) ? items : [];
  state.chat.selectedSession = selected || null;
  notify();
}

export function setChatMessages(items) {
  state.chat.messages = Array.isArray(items) ? items : [];
  notify();
}

export function appendChatMessage(message) {
  state.chat.messages.push(message);
  state.chat.messages = state.chat.messages.slice(-200);
  notify();
}

export function clearShellTranscript() {
  state.shell.entries = [];
  state.shell.lastOutput = "";
  notify();
}

export function addShellEntry(entry) {
  const stdout = entry.stdout || "";
  const stderr = entry.stderr || "";
  const merged = [stdout, stderr].filter(Boolean).join("\n").trim();

  state.shell.entries.unshift({
    ts_ms: Date.now(),
    command: entry.command || "",
    stdout,
    stderr,
    output: merged,
    exit_code: typeof entry.exit_code === "number" ? entry.exit_code : 0,
  });
  state.shell.entries = state.shell.entries.slice(0, 160);
  if (entry.command) {
    state.shell.commandHistory.unshift(entry.command);
    state.shell.commandHistory = state.shell.commandHistory.slice(0, 120);
  }
  if (merged) {
    state.shell.lastOutput = merged;
  }
  notify();
}

export function setProviders(items) {
  state.providers.items = Array.isArray(items) ? items : [];
  state.health.providers.count = state.providers.items.length;
  notify();
}

export function setActiveProvider(active) {
  state.providers.active = active || null;
  notify();
}

export function setProvidersError(message) {
  state.providers.lastError = message || "";
  state.health.providers.lastError = message || "none";
  notify();
}

export function addMindGraphActivation(payload, tsMs = Date.now()) {
  const nodeId = payload?.id || payload?.node || "unknown";
  const nodeLabel = payload?.label || payload?.node || nodeId;
  const score = Number(payload?.score || payload?.weight || 0.5);

  const existing = state.mind.nodes[nodeId] || {
    id: nodeId,
    label: nodeLabel,
    hits: 0,
    score: 0,
    last_ts_ms: tsMs,
  };

  state.mind.nodes[nodeId] = {
    ...existing,
    label: nodeLabel,
    hits: existing.hits + 1,
    score,
    last_ts_ms: tsMs,
  };

  const neighbors = Array.isArray(payload?.neighbors) ? payload.neighbors : [];
  for (const neighbor of neighbors) {
    if (!neighbor) continue;
    const key = `${nodeId}::${neighbor}`;
    state.mind.edges[key] = {
      source: nodeId,
      target: String(neighbor),
      weight: (state.mind.edges[key]?.weight || 0) + 1,
    };
    if (!state.mind.nodes[neighbor]) {
      state.mind.nodes[neighbor] = {
        id: String(neighbor),
        label: String(neighbor),
        hits: 0,
        score: 0.4,
        last_ts_ms: tsMs,
      };
    }
  }

  state.mind.activations.unshift({
    id: nodeId,
    label: nodeLabel,
    score,
    ts_ms: tsMs,
    raw: payload || {},
  });
  state.mind.activations = state.mind.activations.slice(0, 200);
  notify();
}
