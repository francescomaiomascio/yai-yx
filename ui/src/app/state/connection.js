import { setConnection, setHealth, setRuntimeMode, setWorkspaces } from "./store.js";

export function applyConnectionState(conn) {
  setConnection(conn);

  if (!conn.connected) {
    setRuntimeMode("DEGRADED");
    setHealth({
      engine: { state: "offline" },
      kernel: { state: "offline" },
    });
    return;
  }

  setRuntimeMode("NORMAL");
}

export function applyWorkspacesState(payload) {
  setWorkspaces(payload);
}

export function markPing(ping) {
  if (!ping?.ok) return;
  setConnection({
    connected: true,
    selected_ws: ping.ws,
    socket_path: ping.socket_path,
    latency_ms: ping.latency_ms,
    last_ok_ts_ms: Date.now(),
  });
}
