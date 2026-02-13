import React, { createContext, useContext, useMemo, useReducer } from "react";
import type {
  AppState,
  CommandHistoryItem,
  ConnectionState,
  EventItem,
  ProviderItem,
  ShellEntry,
  WorkspaceInfo,
} from "./types";

const MAX_EVENTS = 300;
const MAX_LOGS = 500;
const MAX_CMD_HISTORY = 120;
const MAX_SHELL = 160;

export type Action =
  | { type: "route/set"; route: string }
  | { type: "ui/nav"; collapsed: boolean }
  | { type: "ui/commandCenter"; open: boolean }
  | { type: "connection/set"; payload: Partial<ConnectionState> }
  | { type: "workspaces/set"; selected_ws?: string; items?: WorkspaceInfo[] }
  | { type: "events/add"; event: EventItem }
  | { type: "logs/add"; log: EventItem }
  | { type: "feeds/clear" }
  | { type: "command/add"; item: CommandHistoryItem }
  | { type: "inspector/open"; title: string; item: CommandHistoryItem }
  | { type: "inspector/close" }
  | { type: "providers/set"; items: ProviderItem[] }
  | { type: "providers/active"; active: ProviderItem | null }
  | { type: "providers/error"; message: string }
  | { type: "chat/sessions"; sessions: AppState["chat"]["sessions"]; selected: string | null }
  | { type: "chat/messages"; messages: AppState["chat"]["messages"] }
  | { type: "chat/append"; message: AppState["chat"]["messages"][number] }
  | { type: "shell/add"; entry: ShellEntry }
  | { type: "shell/clear" }
  | { type: "graph/set"; nodes: AppState["graph"]["nodes"]; edges: AppState["graph"]["edges"] }
  | { type: "runtime/set"; mode: string };

const initialState: AppState = {
  connection: {
    connected: false,
    configured_mode: "auto",
    resolved_mode: "real",
    selected_ws: "dev",
    socket_path: "(none)",
    latency_ms: null,
    last_ok_ts_ms: null,
  },
  workspaces: { selected_ws: "dev", items: [] },
  events: [],
  logs: [],
  commandHistory: [],
  inspector: { title: "", item: null },
  providers: { items: [], active: null, lastError: "" },
  chat: { sessions: [], selectedSession: null, messages: [] },
  shell: { entries: [], history: [], lastOutput: "" },
  graph: { nodes: [], edges: [] },
  ui: { route: "overview", navCollapsed: false, commandCenterOpen: false, inspectorOpen: false },
  runtimeMode: "DEGRADED",
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "route/set":
      return { ...state, ui: { ...state.ui, route: action.route } };
    case "ui/nav":
      return { ...state, ui: { ...state.ui, navCollapsed: action.collapsed } };
    case "ui/commandCenter":
      return { ...state, ui: { ...state.ui, commandCenterOpen: action.open } };
    case "connection/set":
      return { ...state, connection: { ...state.connection, ...action.payload } };
    case "workspaces/set":
      return {
        ...state,
        workspaces: {
          selected_ws: action.selected_ws ?? state.workspaces.selected_ws,
          items: action.items ?? state.workspaces.items,
        },
      };
    case "events/add": {
      const events = [action.event, ...state.events].slice(0, MAX_EVENTS);
      return { ...state, events };
    }
    case "logs/add": {
      const logs = [action.log, ...state.logs].slice(0, MAX_LOGS);
      return { ...state, logs };
    }
    case "feeds/clear":
      return { ...state, events: [], logs: [] };
    case "command/add": {
      const commandHistory = [action.item, ...state.commandHistory].slice(0, MAX_CMD_HISTORY);
      return { ...state, commandHistory };
    }
    case "inspector/open":
      return { ...state, inspector: { title: action.title, item: action.item }, ui: { ...state.ui, inspectorOpen: true } };
    case "inspector/close":
      return { ...state, inspector: { title: "", item: null }, ui: { ...state.ui, inspectorOpen: false } };
    case "providers/set":
      return { ...state, providers: { ...state.providers, items: action.items } };
    case "providers/active":
      return { ...state, providers: { ...state.providers, active: action.active } };
    case "providers/error":
      return { ...state, providers: { ...state.providers, lastError: action.message } };
    case "chat/sessions":
      return { ...state, chat: { ...state.chat, sessions: action.sessions, selectedSession: action.selected } };
    case "chat/messages":
      return { ...state, chat: { ...state.chat, messages: action.messages } };
    case "chat/append":
      return { ...state, chat: { ...state.chat, messages: [...state.chat.messages, action.message].slice(-200) } };
    case "shell/add": {
      const entries = [...state.shell.entries, action.entry].slice(-MAX_SHELL);
      const history = action.entry.command
        ? [action.entry.command, ...state.shell.history].slice(0, 120)
        : state.shell.history;
      const output = [action.entry.stdout, action.entry.stderr].filter(Boolean).join("\n").trim();
      return {
        ...state,
        shell: {
          entries,
          history,
          lastOutput: output || state.shell.lastOutput,
        },
      };
    }
    case "shell/clear":
      return { ...state, shell: { ...state.shell, entries: [], lastOutput: "" } };
    case "graph/set":
      return { ...state, graph: { nodes: action.nodes, edges: action.edges } };
    case "runtime/set":
      return { ...state, runtimeMode: action.mode };
    default:
      return state;
  }
}

const StoreContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx.state;
}

export function useAppDispatch() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx.dispatch;
}

export { initialState };
