import { appendChatMessage, setChatMessages, setChatSessions } from "./store.js";
import { runCommand } from "./commands.js";

export async function refreshChatSessions() {
  const res = await runCommand("chat.sessions.list", {});
  const payload = unwrapPayload(res);
  setChatSessions(payload.items || [], payload.selected || null);
}

export async function refreshChatHistory(sessionId = null) {
  const res = await runCommand("chat.history", { session_id: sessionId });
  const payload = unwrapPayload(res);
  const items = payload.items || [];
  setChatMessages(items.map((x) => normalizeMessage(x)));
}

export async function sendChat(text, sessionId = null, stream = true) {
  if (!text.trim()) return;
  appendChatMessage({ role: "user", content: text, ts_ms: Date.now() });
  const res = await runCommand("chat.send", { text, session_id: sessionId, stream });
  const payload = unwrapPayload(res);
  const msg = payload.message || payload;
  appendChatMessage(normalizeMessage(msg));
}

function normalizeMessage(x) {
  return {
    role: (x.role || "assistant").toLowerCase(),
    content: x.content || "",
    ts_ms: x.ts_ms || Date.now(),
    id: x.id || `msg-${Date.now()}`,
  };
}

function unwrapPayload(response) {
  if (!response || typeof response !== "object") return {};
  if (response.payload && typeof response.payload === "object") return response.payload;
  return response;
}
