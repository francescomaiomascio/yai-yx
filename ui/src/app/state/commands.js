import { pushCommandHistory, setToast } from "./store.js";
import { sendCommand } from "../api/bridge.js";

export async function runCommand(name, args = {}, arming = false) {
  const tsMs = Date.now();
  const request = {
    protocol_version: "v1",
    trace_id: `ui-${tsMs}-${Math.floor(Math.random() * 10000)}`,
    name,
    args,
    arming,
  };

  try {
    const response = await dispatch(name, args, arming);
    const ok = Boolean(response?.ok);

    pushCommandHistory({
      name,
      ts_ms: tsMs,
      ok,
      trace_id: response?.trace_id || request.trace_id,
      request,
      response: ok ? response : null,
      error: ok ? null : response?.error || { code: "unknown", message: "command failed" },
    });

    if (!ok) {
      const msg = response?.error?.message || `Command failed: ${name}`;
      setToast(msg, "deny");
      throw new Error(msg);
    }

    return response;
  } catch (error) {
    const wrappedError = {
      code: "internal_error",
      message: String(error?.message || error),
      trace_id: request.trace_id,
    };

    pushCommandHistory({
      name,
      ts_ms: tsMs,
      ok: false,
      trace_id: request.trace_id,
      request,
      response: null,
      error: wrappedError,
    });

    setToast(wrappedError.message, "deny");
    throw error;
  }
}

async function dispatch(name, args, arming) {
  if (name === "law.snapshot") {
    const status = await sendCommand("status", {}, arming);
    if (!status?.ok) return status;

    return {
      trace_id: status.trace_id,
      ok: true,
      payload: {
        type: "law_snapshot",
        source: "status",
        summary: "law snapshot derived from control-plane status",
        status: status.payload,
      },
      error: null,
    };
  }

  return sendCommand(name, args, arming);
}
