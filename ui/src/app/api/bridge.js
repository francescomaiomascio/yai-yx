import { applyConnectionState, applyWorkspacesState, markPing } from "../state/connection.js";
import { ingestEvent } from "../state/events.js";

let offlineTimer = null;
let watchdogTimer = null;
let lastConnectionEventTs = 0;
let subscribed = false;
const DEV_OFFLINE = new URLSearchParams(window.location.search).get("dev_offline") === "1";

function tauri() {
  return window.__TAURI__;
}

function baseOfflineState() {
  return {
    configured_mode: "auto",
    resolved_mode: "real",
    selected_ws: "dev",
    socket_path: "(none)",
    connected: false,
    latency_ms: null,
    last_ok_ts_ms: null,
  };
}

export async function getConnectionState() {
  const t = tauri();
  if (!t?.core?.invoke) return baseOfflineState();
  return t.core.invoke("yx_connection_state");
}

export async function getWorkspaces() {
  const t = tauri();
  if (!t?.core?.invoke) {
    return {
      selected_ws: "dev",
      items: [{ ws: "dev", socket_path: "(none)", exists: false, alive: false }],
    };
  }
  return t.core.invoke("yx_workspaces_list");
}

export async function selectWorkspace(ws) {
  const t = tauri();
  if (!t?.core?.invoke) return baseOfflineState();
  return t.core.invoke("yx_workspace_select", { ws });
}

export async function ping() {
  const t = tauri();
  if (!t?.core?.invoke) {
    return {
      ok: false,
      latency_ms: null,
      ws: "dev",
      socket_path: "(none)",
      error: { code: "runtime_unavailable", message: "tauri runtime unavailable" },
    };
  }
  return t.core.invoke("yx_ping");
}

export async function sendCommand(name, args = {}, arming = false) {
  const t = tauri();
  if (!t?.core?.invoke) {
    return {
      trace_id: `yx-ui-${Date.now()}`,
      ok: false,
      payload: null,
      error: {
        code: "runtime_unavailable",
        message: "tauri runtime unavailable",
        detail: { name, args },
        trace_id: `yx-ui-${Date.now()}`,
      },
    };
  }
  return t.core.invoke("yx_send_command", { name, args, arming });
}

export async function reconnect() {
  const [conn, ws, p] = await Promise.all([getConnectionState(), getWorkspaces(), ping()]);
  applyConnectionState(conn);
  applyWorkspacesState(ws);
  markPing(p);
  if (p?.ok) {
    lastConnectionEventTs = Date.now();
  }
}

export async function connectAndSubscribe() {
  await reconnect();

  const t = tauri();
  if (t?.event?.listen && !subscribed) {
    subscribed = true;

    await t.event.listen("yx:event", (evt) => {
      ingestEvent(evt.payload || {});
    });

    await t.event.listen("yx:connection", (evt) => {
      const payload = evt.payload || {};
      if (payload.connection) applyConnectionState(payload.connection);
      if (payload.workspaces) applyWorkspacesState(payload.workspaces);
      if (payload.ping) markPing(payload.ping);
      if (payload.ping?.ok) {
        lastConnectionEventTs = Date.now();
      }
    });
  }

  if (DEV_OFFLINE) {
    startOfflineGenerator();
  } else {
    stopOfflineGenerator();
  }

  startWatchdog();
}

function startWatchdog() {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(async () => {
    const stale = Date.now() - lastConnectionEventTs > 15000;
    if (stale) {
      await reconnect().catch(() => {});
    }
  }, 20000);
}

function startOfflineGenerator() {
  if (offlineTimer) return;
  offlineTimer = setInterval(() => {
    const now = Date.now();
    const sample = [
      { topic: "state.changed", severity: "warn", payload: { mode: "degraded", connected: false }, ts_ms: now },
      { topic: "log.line", severity: "info", payload: { line: "offline dev generator" }, ts_ms: now },
    ];
    ingestEvent(sample[Math.floor(Math.random() * sample.length)]);
  }, 1500);
}

function stopOfflineGenerator() {
  if (!offlineTimer) return;
  clearInterval(offlineTimer);
  offlineTimer = null;
}
