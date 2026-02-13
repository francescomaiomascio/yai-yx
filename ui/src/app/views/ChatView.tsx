import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import { executeCommand } from "../core/commands";
import type { ChatMessage, ChatSession } from "../state/types";

function normalizeSessions(result: any): { items: ChatSession[]; selected: string | null } {
  if (!result) return { items: [], selected: null };
  const items = result.items || result.sessions || [];
  const normalized = Array.isArray(items)
    ? items.map((s: any) => ({ id: String(s.id || s.session_id || s.name), title: s.title }))
    : [];
  return { items: normalized, selected: result.selected || (normalized[0]?.id ?? null) };
}

function normalizeMessages(result: any): ChatMessage[] {
  if (!result) return [];
  const items = result.items || result.messages || result.history || [];
  if (Array.isArray(items)) {
    return items.map((m: any) => ({ role: String(m.role || "assistant").toLowerCase(), content: m.content || "" }));
  }
  return [];
}

export function ChatView() {
  const { chat } = useAppState();
  const dispatch = useAppDispatch();
  const [text, setText] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const loadSessions = async () => {
    const res = await executeCommand(dispatch, "chat.sessions.list");
    if (res.ok) {
      const parsed = normalizeSessions(res.result as any);
      dispatch({ type: "chat/sessions", sessions: parsed.items, selected: parsed.selected });
      if (parsed.selected) {
        await loadHistory(parsed.selected);
      }
    }
  };

  const loadHistory = async (session_id: string) => {
    const res = await executeCommand(dispatch, "chat.history", { session_id });
    if (res.ok) {
      dispatch({ type: "chat/messages", messages: normalizeMessages(res.result as any) });
    }
  };

  const createSession = async () => {
    const res = await executeCommand(dispatch, "chat.session.new", { title: newTitle || undefined });
    if (res.ok) {
      await loadSessions();
      setNewTitle("");
    }
  };

  const send = async () => {
    if (!text.trim()) return;
    const session_id = chat.selectedSession || undefined;
    const res = await executeCommand(dispatch, "chat.send", { session_id, text });
    if (res.ok) {
      const result = res.result as any;
      const message = result?.message || result?.item;
      if (message) {
        dispatch({ type: "chat/append", message: { role: message.role || "assistant", content: message.content || "" } });
      } else {
        dispatch({ type: "chat/append", message: { role: "assistant", content: "(ok)" } });
      }
      setText("");
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="yx-chat-view">
      <div className="yx-chat-grid">
        <section className="yx-panel yx-chat-sessions">
          <header>
            <h3>Sessions</h3>
            <p className="yx-muted">Select or create</p>
          </header>
          <div className="yx-input-row">
            <input
              type="text"
              placeholder="new session title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="button" onClick={createSession}>
              New
            </button>
          </div>
          <select
            value={chat.selectedSession || ""}
            onChange={(e) => {
              const val = e.target.value;
              dispatch({ type: "chat/sessions", sessions: chat.sessions, selected: val || null });
              if (val) loadHistory(val);
            }}
          >
            <option value="">(select session)</option>
            {chat.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.id}
              </option>
            ))}
          </select>
        </section>

        <section className="yx-panel yx-chat-main">
          <header>
            <h3>Transcript</h3>
            <p className="yx-muted">Latest messages</p>
          </header>
          <div className="yx-chat-transcript">
            {chat.messages.length === 0 ? (
              <div className="yx-muted">No messages yet.</div>
            ) : (
              chat.messages.map((m, idx) => (
                <div key={`${m.role}-${idx}`} className="yx-chat-msg">
                  <b>{m.role}</b>
                  <span>{m.content}</span>
                </div>
              ))
            )}
          </div>
          <div className="yx-chat-compose">
            <input
              type="text"
              placeholder="Type message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <button type="button" onClick={send}>
              Send
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
