import type { Dispatch } from "react";
import type { Action } from "../state/store.tsx";
import type { ConnectionState, EventItem, WorkspaceInfo } from "../state/types";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";

function tauri() {
  return (window as any).__TAURI__;
}

function baseConnection(): ConnectionState {
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

export async function getConnectionState(): Promise<ConnectionState> {
  const t = tauri();
  if (!t?.core?.invoke) return baseConnection();
  return t.core.invoke("yx_connection_state");
}

export async function getWorkspaces(): Promise<{ selected_ws: string; items: WorkspaceInfo[] }> {
  const t = tauri();
  if (!t?.core?.invoke) {
    return { selected_ws: "dev", items: [{ ws: "dev", socket_path: "(none)", exists: false, alive: false }] };
  }
  return t.core.invoke("yx_workspaces_list");
}

export async function selectWorkspace(ws: string): Promise<ConnectionState> {
  const t = tauri();
  if (!t?.core?.invoke) return baseConnection();
  return t.core.invoke("yx_workspace_select", { ws });
}

export async function ping(): Promise<{ ok: boolean; latency_ms?: number; socket_path: string; ws: string; error?: any }> {
  const t = tauri();
  if (!t?.core?.invoke) {
    return { ok: false, latency_ms: undefined, ws: "dev", socket_path: "(none)", error: { code: "runtime_unavailable", message: "tauri runtime unavailable" } };
  }
  return t.core.invoke("yx_ping");
}

export async function sendCommand(name: string, args: Record<string, unknown> = {}, arming = false) {
  const t = tauri();
  if (!t?.core?.invoke) {
    const id = `yx-ui-${Date.now()}`;
    return {
      id,
      ts_ms: Date.now(),
      name,
      ok: false,
      result: null,
      error: { code: "runtime_unavailable", message: "tauri runtime unavailable", detail: { name, args } },
    };
  }
  return t.core.invoke("yx_send_command", { name, args, arming });
}

function normalizeEvent(raw: any): EventItem {
  return {
    topic: String(raw?.topic || "unknown"),
    severity: String(raw?.severity || "info"),
    ts_ms: Number(raw?.ts_ms || Date.now()),
    payload: raw?.payload ?? {},
    trace_id: raw?.trace_id ?? null,
  };
}

function ingestEvent(dispatch: Dispatch<Action>, event: EventItem) {
  dispatch({ type: "events/add", event });
  if (event.topic.toLowerCase().includes("log") || event.severity !== "info") {
    dispatch({ type: "logs/add", log: event });
  }
  if (event.topic.startsWith("mind.graph")) {
    const payload = event.payload as any;
    const nodeId = String(payload?.id || payload?.node || "unknown");
    const nodes = [{ id: nodeId, label: payload?.label || nodeId, score: Number(payload?.score || payload?.weight || 0.5) }];
    const edges = Array.isArray(payload?.neighbors)
      ? payload.neighbors.map((n: any, idx: number) => ({ id: `${nodeId}-${idx}`, source: nodeId, target: String(n), weight: 1 }))
      : [];
    dispatch({ type: "graph/set", nodes, edges });
  }
}

let offlineTimer: number | null = null;

function startOfflineGenerator(dispatch: React.Dispatch<Action>) {
  if (offlineTimer) return;
  offlineTimer = window.setInterval(() => {
    const now = Date.now();
    const sample = [
      { topic: "state.changed", severity: "warn", payload: { mode: "degraded", connected: false }, ts_ms: now },
      { topic: "log.line", severity: "info", payload: { line: "offline dev generator" }, ts_ms: now },
    ];
    ingestEvent(dispatch, normalizeEvent(sample[Math.floor(Math.random() * sample.length)]));
  }, 1500);
}

function stopOfflineGenerator() {
  if (!offlineTimer) return;
  window.clearInterval(offlineTimer);
  offlineTimer = null;
}

export async function connectAndSubscribe(dispatch: Dispatch<Action>) {
  const [conn, ws, p] = await Promise.all([getConnectionState(), getWorkspaces(), ping()]);
  dispatch({ type: "connection/set", payload: { ...conn, last_ok_ts_ms: p?.ok ? Date.now() : conn.last_ok_ts_ms } });
  dispatch({ type: "workspaces/set", selected_ws: ws.selected_ws, items: ws.items });

  const t = tauri();
  if (t?.event?.listen) {
    await t.event.listen("yx:event", (evt: any) => {
      ingestEvent(dispatch, normalizeEvent(evt?.payload || {}));
    });

    await t.event.listen("yx:connection", (evt: any) => {
      const payload = evt?.payload || {};
      if (payload.connection) {
        dispatch({
          type: "connection/set",
          payload: {
            ...payload.connection,
            last_ok_ts_ms: payload.ping?.ok ? Date.now() : payload.connection.last_ok_ts_ms,
            connected: payload.ping?.ok ?? payload.connection.connected,
          },
        });
      }
      if (payload.workspaces) {
        dispatch({ type: "workspaces/set", selected_ws: payload.workspaces.selected_ws, items: payload.workspaces.items });
      }
      if (payload.ping?.ok) {
        dispatch({ type: "connection/set", payload: { latency_ms: payload.ping.latency_ms, last_ok_ts_ms: Date.now() } });
      }
    });
  }

  if (DEV_MODE) startOfflineGenerator(dispatch);
  else stopOfflineGenerator();
}
