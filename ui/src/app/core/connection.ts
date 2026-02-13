import type { ConnectionState } from "../state/types";

export const CONNECTION_TTL_MS = 5000;

export function isConnected(connection: ConnectionState, now: number = Date.now()): boolean {
  if (!connection.connected) return false;
  if (!connection.last_ok_ts_ms) return false;
  return now - connection.last_ok_ts_ms <= CONNECTION_TTL_MS;
}

export function connectionBadge(connection: ConnectionState): { text: string; tone: "ok" | "warn" | "deny" } {
  if (isConnected(connection)) return { text: "CONNECTED", tone: "ok" };
  if (connection.socket_path && connection.socket_path !== "(none)") {
    return { text: "STALE", tone: "warn" };
  }
  return { text: "OFFLINE", tone: "deny" };
}
