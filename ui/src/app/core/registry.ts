export type CommandMeta = {
  name: string;
  title: string;
  description: string;
  category: string;
  sample_args?: string;
  arming?: boolean;
};

export const COMMAND_REGISTRY: CommandMeta[] = [
  { name: "status", title: "Status", description: "Control plane status", category: "Control", sample_args: "{}" },
  { name: "law.snapshot", title: "Law Snapshot", description: "Law snapshot", category: "Law", sample_args: "{}" },
  { name: "providers.discover", title: "Discover Providers", description: "Discover providers", category: "Providers", sample_args: "{\n  \"endpoint\": \"http://localhost:8080\",\n  \"model\": \"gpt-4\"\n}", arming: true },
  { name: "providers.list", title: "List Providers", description: "List providers", category: "Providers", sample_args: "{}", arming: true },
  { name: "providers.status", title: "Providers Status", description: "Active provider status", category: "Providers", sample_args: "{}", arming: true },
  { name: "providers.pair", title: "Pair Provider", description: "Pair provider", category: "Providers", sample_args: "{\n  \"id\": \"provider-id\",\n  \"endpoint\": \"http://localhost:8080\",\n  \"model\": \"gpt-4\"\n}", arming: true },
  { name: "providers.attach", title: "Attach Provider", description: "Attach provider", category: "Providers", sample_args: "{\n  \"id\": \"provider-id\",\n  \"model\": \"gpt-4\"\n}", arming: true },
  { name: "providers.detach", title: "Detach Provider", description: "Detach provider", category: "Providers", sample_args: "{}", arming: true },
  { name: "providers.revoke", title: "Revoke Provider", description: "Revoke provider", category: "Providers", sample_args: "{\n  \"id\": \"provider-id\"\n}", arming: true },
  { name: "chat.sessions.list", title: "Chat Sessions", description: "List chat sessions", category: "Chat", sample_args: "{}" },
  { name: "chat.session.new", title: "New Session", description: "Create chat session", category: "Chat", sample_args: "{\n  \"title\": \"ops\"\n}" },
  { name: "chat.history", title: "Chat History", description: "Chat history", category: "Chat", sample_args: "{\n  \"session_id\": \"session-id\"\n}" },
  { name: "chat.send", title: "Send Chat", description: "Send chat message", category: "Chat", sample_args: "{\n  \"session_id\": \"session-id\",\n  \"text\": \"hello\"\n}" },
  { name: "shell.exec", title: "Shell Exec", description: "Run shell command", category: "Shell", sample_args: "{\n  \"cmd\": \"ls\"\n}", arming: true },
  { name: "events.subscribe", title: "Subscribe Events", description: "Subscribe to events stream", category: "Control", sample_args: "{}" },
];

export const COMMAND_CATEGORIES = Array.from(new Set(COMMAND_REGISTRY.map((c) => c.category)));
