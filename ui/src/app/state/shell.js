import { addShellEntry } from "./store.js";
import { runCommand } from "./commands.js";

export async function runShellCommand(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return;
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);
  const res = await runCommand("shell.exec", { cmd, args });
  const payload = unwrapPayload(res);

  addShellEntry({
    command: trimmed,
    stdout: payload.stdout || "",
    stderr: payload.stderr || "",
    exit_code: payload.exit_code ?? 0,
  });
}

function unwrapPayload(response) {
  if (!response || typeof response !== "object") return {};
  if (response.payload && typeof response.payload === "object") return response.payload;
  return response;
}
