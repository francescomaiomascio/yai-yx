import {
  addEvent,
  addLog,
  addMindGraphActivation,
  setHealth,
  setProviders,
  setProvidersError,
  setRuntimeMode,
} from "./store.js";

function asTsMs(input) {
  if (typeof input === "number") {
    return input < 10_000_000_000 ? input * 1000 : input;
  }
  return Date.now();
}

function summarize(item) {
  if (!item) return "-";
  if (item.msg) return String(item.msg);
  if (item.topic) return String(item.topic);
  if (item.payload && typeof item.payload === "object") {
    const keys = Object.keys(item.payload).slice(0, 3);
    if (keys.length) return keys.map((k) => `${k}:${String(item.payload[k])}`).join(" ");
  }
  return "event";
}

function inferSeverity(item) {
  const v = (item.severity || item.level || "info").toLowerCase();
  if (v.includes("err") || v.includes("deny") || v.includes("critical")) return "error";
  if (v.includes("warn")) return "warn";
  return "info";
}

export function normalizeIncoming(raw) {
  const topic = raw.topic || raw.kind || raw.type || "state.changed";
  return {
    ts_ms: asTsMs(raw.ts_ms || raw.ts || Date.now()),
    topic,
    severity: inferSeverity(raw),
    summary: summarize(raw),
    payload: raw.payload || raw.data || raw,
    raw,
  };
}

export function ingestEvent(raw) {
  const event = normalizeIncoming(raw);
  addEvent(event);

  const topic = event.topic.toLowerCase();
  if (topic.includes("log") || event.severity !== "info") {
    addLog(event);
  }

  if (topic === "law.violation") {
    setHealth({ law: { violations: 1, lastViolationTs: event.ts_ms } });
    setRuntimeMode("LOCKDOWN");
  }

  if (topic === "mind.graph.activation") {
    setHealth({ mind: { lastActivationTs: event.ts_ms, active: true } });
    addMindGraphActivation(event.payload, event.ts_ms);
  }

  if (topic === "provider.status" || topic === "provider_attached" || topic === "provider_detached") {
    const providers = event.payload?.providers;
    if (Array.isArray(providers)) {
      setProviders(providers);
    } else if (event.payload?.provider_id) {
      setHealth({ providers: { count: 1 } });
    }
    if (event.severity === "error") {
      setProvidersError(event.summary);
    }
  }

  if (topic === "state.changed") {
    const mode = String(event.payload?.mode || "").toLowerCase();
    if (mode === "lockdown") setRuntimeMode("LOCKDOWN");
    else if (mode === "degraded") setRuntimeMode("DEGRADED");
    else if (mode) setRuntimeMode("NORMAL");
  }
}
