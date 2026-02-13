export type ConnectionState = {
  configured_mode: string;
  resolved_mode: string;
  selected_ws: string;
  socket_path: string;
  connected: boolean;
  latency_ms: number | null;
  last_ok_ts_ms: number | null;
};

export type WorkspaceInfo = {
  ws: string;
  socket_path: string;
  exists: boolean;
  alive: boolean;
};

export type WorkspacesState = {
  selected_ws: string;
  items: WorkspaceInfo[];
};

export type EventItem = {
  topic: string;
  severity: string;
  ts_ms: number;
  payload: Record<string, unknown> | unknown;
  trace_id?: string | null;
};

export type CommandRequestEnvelope = {
  id: string;
  ts_ms: number;
  name: string;
  args: Record<string, unknown>;
  arming?: boolean;
};

export type CommandError = {
  code: string;
  message: string;
  details?: unknown;
};

export type CommandResponseEnvelope = {
  id: string;
  ts_ms: number;
  name: string;
  ok: boolean;
  result?: unknown;
  error?: CommandError;
};

export type CommandHistoryItem = {
  trace_id: string;
  name: string;
  ts_ms: number;
  ok: boolean;
  request: CommandRequestEnvelope;
  response?: CommandResponseEnvelope;
  error?: CommandError;
};

export type ShellEntry = {
  id: string;
  ts_ms: number;
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
};

export type ProviderItem = {
  id: string;
  endpoint?: string;
  model?: string;
  state?: string;
  last_seen?: number;
  last_error?: string;
};

export type ProviderState = {
  items: ProviderItem[];
  active: ProviderItem | null;
  lastError: string;
};

export type ChatSession = {
  id: string;
  title?: string;
};

export type ChatMessage = {
  role: string;
  content: string;
  ts_ms?: number;
};

export type ChatState = {
  sessions: ChatSession[];
  selectedSession: string | null;
  messages: ChatMessage[];
};

export type GraphNode = {
  id: string;
  label?: string;
  score?: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  weight?: number;
};

export type GraphState = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type UIState = {
  route: string;
  navCollapsed: boolean;
  commandCenterOpen: boolean;
  inspectorOpen: boolean;
};

export type AppState = {
  connection: ConnectionState;
  workspaces: WorkspacesState;
  events: EventItem[];
  logs: EventItem[];
  commandHistory: CommandHistoryItem[];
  inspector: { title: string; item: CommandHistoryItem | null };
  providers: ProviderState;
  chat: ChatState;
  shell: { entries: ShellEntry[]; history: string[]; lastOutput: string };
  graph: GraphState;
  ui: UIState;
  runtimeMode: string;
};
