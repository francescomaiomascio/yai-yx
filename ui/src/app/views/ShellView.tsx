import React, { useRef, useState } from "react";
import { executeCommand } from "../core/commands";
import { useAppDispatch, useAppState } from "../state/store.tsx";
import type { ShellEntry } from "../state/types";

function normalizeShellEntry(result: any, command: string): ShellEntry {
  return {
    id: `shell-${Date.now()}`,
    ts_ms: Date.now(),
    command,
    stdout: result?.stdout ?? "",
    stderr: result?.stderr ?? "",
    exit_code: typeof result?.exit_code === "number" ? result.exit_code : 0,
  };
}

export function ShellView() {
  const { shell } = useAppState();
  const dispatch = useAppDispatch();
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const run = async () => {
    const cmd = input.trim();
    if (!cmd) return;
    const res = await executeCommand(dispatch, "shell.exec", { cmd }, { arming: true });
    if (res.ok) {
      dispatch({ type: "shell/add", entry: normalizeShellEntry(res.result as any, cmd) });
    } else {
      dispatch({
        type: "shell/add",
        entry: {
          id: `shell-${Date.now()}`,
          ts_ms: Date.now(),
          command: cmd,
          stdout: "",
          stderr: res.error?.message || "command failed",
          exit_code: 1,
        },
      });
    }
    setInput("");
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextIndex = Math.min(shell.history.length - 1, historyIndex + 1);
      if (shell.history[nextIndex]) {
        setInput(shell.history[nextIndex]);
        setHistoryIndex(nextIndex);
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = Math.max(-1, historyIndex - 1);
      if (nextIndex === -1) {
        setInput("");
        setHistoryIndex(-1);
      } else if (shell.history[nextIndex]) {
        setInput(shell.history[nextIndex]);
        setHistoryIndex(nextIndex);
      }
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      dispatch({ type: "shell/clear" });
    }
  };

  const copyLast = async () => {
    if (!shell.lastOutput) return;
    try {
      await navigator.clipboard.writeText(shell.lastOutput);
    } catch {
      // ignore
    }
  };

  return (
    <div className="yx-terminal">
      <div className="yx-terminal__header">
        <div>Shell</div>
        <div className="yx-terminal__controls">
          <button type="button" onClick={() => dispatch({ type: "shell/clear" })}>
            Clear
          </button>
          <button type="button" onClick={copyLast}>
            Copy last output
          </button>
        </div>
      </div>
      <div className="yx-terminal__body">
        {shell.entries.length === 0 ? (
          <div className="yx-muted">No commands yet.</div>
        ) : (
          shell.entries.map((entry) => (
            <div key={entry.id} className="yx-terminal__entry">
              <div className="yx-terminal__prompt">$ {entry.command}</div>
              {entry.stdout ? <pre>{entry.stdout}</pre> : null}
              {entry.stderr ? <pre>{entry.stderr}</pre> : null}
              <div className="yx-muted">exit {entry.exit_code}</div>
            </div>
          ))
        )}
      </div>
      <div className="yx-terminal__input">
        <span className="yx-terminal__prompt-symbol">$</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="command"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" onClick={run}>
          Run
        </button>
      </div>
    </div>
  );
}
