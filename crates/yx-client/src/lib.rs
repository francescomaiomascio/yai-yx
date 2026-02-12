use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
#[cfg(unix)]
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use yx_protocol::{CommandError, CommandRequest, CommandResult};

const DEFAULT_PING_TIMEOUT_MS: u64 = 450;
static TRACE_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    Auto,
    Mock,
    Real,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub ws: String,
    pub socket_path: String,
    pub exists: bool,
    pub alive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspacesList {
    pub items: Vec<WorkspaceInfo>,
    pub selected_ws: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PingState {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub socket_path: String,
    pub ws: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<CommandError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionState {
    pub configured_mode: Mode,
    pub resolved_mode: Mode,
    pub selected_ws: String,
    pub socket_path: String,
    pub connected: bool,
    pub latency_ms: Option<u64>,
    pub last_ok_ts_ms: Option<u64>,
}

pub fn mode_from_env() -> Mode {
    match env::var("YX_MODE").ok().as_deref() {
        Some("mock") => Mode::Mock,
        Some("real") => Mode::Real,
        _ => Mode::Auto,
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn next_trace_id() -> String {
    format!("yx-{}-{}", now_ms(), TRACE_COUNTER.fetch_add(1, Ordering::Relaxed))
}

fn home_dir() -> String {
    env::var("HOME").unwrap_or_else(|_| ".".to_string())
}

fn run_root() -> String {
    format!("{}/.yai/run", home_dir())
}

fn socket_path_for_ws(ws: &str) -> String {
    format!("{}/{}/control.sock", run_root(), ws)
}

fn parse_workspace_from_toml(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.is_empty() {
            continue;
        }
        let is_ws_key = trimmed.starts_with("ws") || trimmed.starts_with("workspace");
        if !is_ws_key {
            continue;
        }
        let mut parts = trimmed.splitn(2, '=');
        let _key = parts.next()?;
        let raw = parts.next()?.trim();
        let quoted = raw.trim_matches('"').trim_matches('\'');
        if !quoted.is_empty() {
            return Some(quoted.to_string());
        }
    }
    None
}

fn ws_from_config() -> Option<String> {
    let candidates = [
        format!("{}/.yai/yai.toml", home_dir()),
        format!("{}/.config/yai/yai.toml", home_dir()),
        "yai.toml".to_string(),
    ];
    for path in candidates {
        if let Ok(content) = fs::read_to_string(path) {
            if let Some(ws) = parse_workspace_from_toml(&content) {
                return Some(ws);
            }
        }
    }
    None
}

fn list_known_workspaces() -> Vec<String> {
    let mut out = vec!["dev".to_string(), "stage".to_string(), "prod".to_string()];
    let root = PathBuf::from(run_root());
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !out.iter().any(|w| w == &name) {
                        out.push(name);
                    }
                }
            }
        }
    }
    out
}

#[cfg(unix)]
fn ping_socket(sock: &str, timeout: Duration) -> Result<u64> {
    let trace_id = next_trace_id();
    let started = Instant::now();
    let _ = send_command_real(sock, "status", json!({}), false, &trace_id, timeout)?;
    Ok(started.elapsed().as_millis() as u64)
}

#[cfg(not(unix))]
fn ping_socket(_sock: &str, _timeout: Duration) -> Result<u64> {
    Err(anyhow!("real mode requires unix sockets"))
}

fn resolve_ws_preference() -> String {
    if let Ok(ws) = env::var("YAI_WS") {
        if !ws.trim().is_empty() {
            return ws;
        }
    }
    if let Some(ws) = ws_from_config() {
        return ws;
    }
    let candidates = list_known_workspaces();
    for ws in candidates {
        let sock = socket_path_for_ws(&ws);
        if fs::metadata(&sock).is_ok() {
            if ping_socket(&sock, Duration::from_millis(DEFAULT_PING_TIMEOUT_MS)).is_ok() {
                return ws;
            }
        }
    }
    "dev".to_string()
}

pub fn workspaces_list() -> WorkspacesList {
    let selected_ws = resolve_ws_preference();
    let timeout = Duration::from_millis(DEFAULT_PING_TIMEOUT_MS);
    let items = list_known_workspaces()
        .into_iter()
        .map(|ws| {
            let socket_path = socket_path_for_ws(&ws);
            let exists = fs::metadata(&socket_path).is_ok();
            let alive = exists && ping_socket(&socket_path, timeout).is_ok();
            WorkspaceInfo {
                ws,
                socket_path,
                exists,
                alive,
            }
        })
        .collect();

    WorkspacesList { items, selected_ws }
}

pub fn connection_state() -> ConnectionState {
    let configured_mode = mode_from_env();
    let selected_ws = resolve_ws_preference();
    let socket_path = socket_path_for_ws(&selected_ws);

    let ping = ping_socket(&socket_path, Duration::from_millis(DEFAULT_PING_TIMEOUT_MS));
    let connected = ping.is_ok();
    let latency_ms = ping.ok();

    let resolved_mode = match configured_mode {
        Mode::Mock => Mode::Mock,
        Mode::Auto | Mode::Real => Mode::Real,
    };

    ConnectionState {
        configured_mode,
        resolved_mode,
        selected_ws,
        socket_path: if connected {
            socket_path
        } else {
            "(none)".to_string()
        },
        connected,
        latency_ms,
        last_ok_ts_ms: if connected { Some(now_ms()) } else { None },
    }
}

pub fn ping_selected() -> PingState {
    let selected_ws = resolve_ws_preference();
    let socket_path = socket_path_for_ws(&selected_ws);
    let timeout = Duration::from_millis(DEFAULT_PING_TIMEOUT_MS);

    match ping_socket(&socket_path, timeout) {
        Ok(latency_ms) => PingState {
            ok: true,
            latency_ms: Some(latency_ms),
            socket_path,
            ws: selected_ws,
            error: None,
        },
        Err(error) => PingState {
            ok: false,
            latency_ms: None,
            socket_path,
            ws: selected_ws,
            error: Some(CommandError {
                code: "sock_unavailable".to_string(),
                message: error.to_string(),
                detail: None,
                trace_id: next_trace_id(),
            }),
        },
    }
}

pub fn send_command(name: &str, args: Value, arming: bool) -> CommandResult {
    let trace_id = next_trace_id();
    let state = connection_state();

    if state.resolved_mode == Mode::Mock {
        return CommandResult {
            trace_id,
            ok: true,
            payload: Some(mock_response(name, args)),
            error: None,
        };
    }

    if !state.connected {
        return CommandResult {
            trace_id: trace_id.clone(),
            ok: false,
            payload: None,
            error: Some(CommandError {
                code: "sock_unavailable".to_string(),
                message: format!(
                    "control socket unavailable for workspace '{}'",
                    state.selected_ws
                ),
                detail: Some(json!({
                    "workspace": state.selected_ws,
                    "socket_path": socket_path_for_ws(&state.selected_ws),
                })),
                trace_id,
            }),
        };
    }

    match send_command_real(
        &socket_path_for_ws(&state.selected_ws),
        name,
        args,
        arming,
        &trace_id,
        Duration::from_secs(3),
    ) {
        Ok(payload) => CommandResult {
            trace_id,
            ok: true,
            payload: Some(payload),
            error: None,
        },
        Err(error) => CommandResult {
            trace_id: trace_id.clone(),
            ok: false,
            payload: None,
            error: Some(CommandError {
                code: "command_failed".to_string(),
                message: error.to_string(),
                detail: None,
                trace_id,
            }),
        },
    }
}

fn mock_response(name: &str, args: Value) -> Value {
    match name {
        "status" => json!({
            "mode":"mock",
            "state":"running",
            "runtime_id":"yx-mock",
            "ws":"dev",
            "args": args
        }),
        "chat.send" => {
            let text = args.get("text").and_then(Value::as_str).unwrap_or("");
            json!({
                "mode":"mock",
                "message": {"role":"assistant", "content": format!("echo: {}", text)}
            })
        }
        "providers.list" => json!({
            "mode":"mock",
            "items":[]
        }),
        "providers.status" => json!({
            "mode":"mock",
            "active": null
        }),
        "shell.exec" => json!({
            "mode":"mock",
            "exit_code": 0,
            "stdout": "mock shell ok\n",
            "stderr": ""
        }),
        _ => json!({"mode":"mock", "ok": true, "name": name, "args": args}),
    }
}

#[cfg(unix)]
fn send_command_real(
    sock: &str,
    name: &str,
    args: Value,
    arming: bool,
    trace_id: &str,
    timeout: Duration,
) -> Result<Value> {
    let request = CommandRequest {
        protocol_version: "v1".to_string(),
        trace_id: trace_id.to_string(),
        name: name.to_string(),
        args: args.clone(),
        arming,
    };

    let req = map_request(&request.name, request.args.clone())?;
    let mut stream = UnixStream::connect(sock).with_context(|| format!("connect control socket: {sock}"))?;
    stream.set_read_timeout(Some(timeout)).ok();
    stream.set_write_timeout(Some(timeout)).ok();

    let line = serde_json::to_string(&req)?;
    stream.write_all(line.as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;

    let mut reader = BufReader::new(stream);
    let mut seen_lines = 0u8;
    while seen_lines < 6 {
        let mut resp = String::new();
        let n = reader.read_line(&mut resp)?;
        if n == 0 {
            return Err(anyhow!("empty response from daemon"));
        }
        seen_lines += 1;

        let parsed: Value = serde_json::from_str(resp.trim_end())
            .with_context(|| format!("invalid json response for trace_id={trace_id}"))?;

        let kind = parsed
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if kind == "cmd.ack" {
            continue;
        }
        if kind == "cmd.res" {
            if let Some(payload) = parsed.get("payload") {
                if !payload.is_null() {
                    return Ok(payload.clone());
                }
            }
            if let Some(data) = parsed.get("data") {
                if !data.is_null() {
                    return Ok(data.clone());
                }
            }
        }

        if parsed.is_null() {
            continue;
        }
        if parsed.as_object().is_some_and(|obj| obj.is_empty()) {
            continue;
        }
        return Ok(parsed);
    }

    Err(anyhow!("empty response from daemon"))
}

#[cfg(not(unix))]
fn send_command_real(
    _sock: &str,
    _name: &str,
    _args: Value,
    _arming: bool,
    _trace_id: &str,
    _timeout: Duration,
) -> Result<Value> {
    Err(anyhow!("real mode requires unix sockets"))
}

fn map_request(name: &str, args: Value) -> Result<Value> {
    let v = match name {
        "status" => json!("Status"),
        "ping" => json!("Ping"),
        "providers.discover" => {
            let endpoint = args.get("endpoint").and_then(Value::as_str);
            let model = args.get("model").and_then(Value::as_str);
            json!({"ProvidersDiscover": {"endpoint": endpoint, "model": model}})
        }
        "providers.list" => json!("ProvidersList"),
        "providers.pair" => {
            let id = args
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let endpoint = args
                .get("endpoint")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let model = args
                .get("model")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            json!({"ProvidersPair": {"id": id, "endpoint": endpoint, "model": model}})
        }
        "providers.attach" => {
            let id = args
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let model = args.get("model").and_then(Value::as_str);
            json!({"ProvidersAttach": {"id": id, "model": model}})
        }
        "providers.detach" => json!("ProvidersDetach"),
        "providers.revoke" => {
            let id = args
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            json!({"ProvidersRevoke": {"id": id}})
        }
        "providers.status" => json!("ProvidersStatus"),
        "events.subscribe" => json!("EventsSubscribe"),
        "chat.sessions.list" => json!("ChatSessionsList"),
        "chat.session.new" => {
            let title = args.get("title").and_then(Value::as_str);
            json!({"ChatSessionNew": {"title": title}})
        }
        "chat.history" => {
            let session_id = args.get("session_id").and_then(Value::as_str);
            json!({"ChatHistory": {"session_id": session_id}})
        }
        "chat.send" => {
            let session_id = args.get("session_id").and_then(Value::as_str);
            let text = args
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let stream = args.get("stream").and_then(Value::as_bool).unwrap_or(true);
            json!({"ChatSend": {"session_id": session_id, "text": text, "stream": stream}})
        }
        "shell.exec" => {
            let cmd = args
                .get("cmd")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let cmd_args = args
                .get("args")
                .and_then(Value::as_array)
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(ToString::to_string))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let cwd = args.get("cwd").and_then(Value::as_str);
            json!({"ShellExec": {"cmd": cmd, "args": cmd_args, "cwd": cwd}})
        }
        "down" => {
            let force = args.get("force").and_then(Value::as_bool).unwrap_or(false);
            let shutdown = args
                .get("shutdown")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            json!({"Down": {"force": force, "shutdown": shutdown}})
        }
        _ => return Err(anyhow!("unsupported command: {name}")),
    };
    Ok(v)
}
