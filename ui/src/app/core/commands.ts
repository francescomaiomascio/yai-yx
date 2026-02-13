import type { Dispatch } from "react";
import { sendCommand } from "../api/bridge";
import type { CommandError, CommandHistoryItem, CommandRequestEnvelope, CommandResponseEnvelope } from "../state/types";
import type { Action } from "../state/store.tsx";

let counter = 0;

function nextId() {
  counter += 1;
  return `yx-${Date.now()}-${counter}`;
}

export async function executeCommand(
  dispatch: Dispatch<Action>,
  name: string,
  args: Record<string, unknown> = {},
  opts: { arming?: boolean } = {}
): Promise<CommandResponseEnvelope> {
  const id = nextId();
  const ts_ms = Date.now();
  const request: CommandRequestEnvelope = { id, ts_ms, name, args, arming: opts.arming };

  const raw = await sendCommand(name, args, opts.arming ?? false);
  const ok = Boolean(raw?.ok);
  const response: CommandResponseEnvelope = {
    id: raw?.id || id,
    ts_ms: Date.now(),
    name,
    ok,
    result: ok ? raw?.result ?? raw?.payload ?? null : undefined,
    error: ok
      ? undefined
      : {
          code: raw?.error?.code || "command_failed",
          message: raw?.error?.message || `Command failed: ${name}`,
          details: raw?.error?.details ?? raw?.error?.detail,
        },
  };

  const history: CommandHistoryItem = {
    trace_id: response.id,
    name,
    ts_ms,
    ok,
    request,
    response: ok ? response : undefined,
    error: ok ? undefined : (response.error as CommandError),
  };

  dispatch({ type: "command/add", item: history });
  return response;
}
