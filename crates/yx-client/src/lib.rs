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
use std::sync::{atomic::AtomicBool, Arc};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use yx_protocol::{CommandError, CommandRequest, CommandResult, Event as ProtocolEvent};

const DEFAULT_PING_TIMEOUT_MS: u64 = 1200;
const RPC_PROTOCOL_VERSION: u8 = 1;
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
    format!(
        "yx-{}-{}",
        now_ms(),
        TRACE_COUNTER.fetch_add(1, Ordering::Relaxed)
    )
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
fn ping_socket(sock: &str, ws: &str, timeout: Duration) -> Result<u64> {
    let trace_id = next_trace_id();
    let started = Instant::now();

    // ping minimale, niente handshake a raffica
    let _ = send_command_real(sock, ws, "ping", json!({}), false, &trace_id, timeout)?;

    Ok(started.elapsed().as_millis() as u64)
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
            if ping_socket(&sock, &ws, Duration::from_millis(DEFAULT_PING_TIMEOUT_MS)).is_ok() {
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
            let alive = exists && ping_socket(&socket_path, &ws, timeout).is_ok();
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

    let ping = ping_socket(
        &socket_path,
        &selected_ws,
        Duration::from_millis(DEFAULT_PING_TIMEOUT_MS),
    );
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
        socket_path,
        connected,
        latency_ms,
        last_ok_ts_ms: if connected { Some(now_ms()) } else { None },
    }
}

pub fn ping_selected() -> PingState {
    let selected_ws = resolve_ws_preference();
    let socket_path = socket_path_for_ws(&selected_ws);
    let timeout = Duration::from_millis(DEFAULT_PING_TIMEOUT_MS);

    match ping_socket(&socket_path, &selected_ws, timeout) {
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
                details: None,
                trace_id: Some(next_trace_id()),
            }),
        },
    }
}

pub fn send_command(name: &str, args: Value, arming: bool) -> CommandResult {
    let trace_id = next_trace_id();
    let state = connection_state();
    let ts_ms = now_ms();

    if state.resolved_mode == Mode::Mock {
        return CommandResult {
            id: trace_id,
            ts_ms,
            name: name.to_string(),
            ok: true,
            result: Some(mock_response(name, args)),
            error: None,
        };
    }

    match send_command_real(
        &socket_path_for_ws(&state.selected_ws),
        &state.selected_ws,
        name,
        args,
        arming,
        &trace_id,
        Duration::from_secs(3),
    ) {
        Ok(payload) => CommandResult {
            id: trace_id,
            ts_ms: now_ms(),
            name: name.to_string(),
            ok: true,
            result: Some(payload),
            error: None,
        },
        Err(error) => {
            let (code, message) = if !state.connected {
                (
                    "sock_unavailable".to_string(),
                    format!(
                        "control socket unavailable for workspace '{}': {}",
                        state.selected_ws, error
                    ),
                )
            } else {
                ("command_failed".to_string(), error.to_string())
            };
            CommandResult {
                id: trace_id.clone(),
                ts_ms: now_ms(),
                name: name.to_string(),
                ok: false,
                result: None,
                error: Some(CommandError {
                    code,
                    message,
                    details: Some(json!({
                        "workspace": state.selected_ws,
                        "socket_path": socket_path_for_ws(&state.selected_ws),
                    })),
                    trace_id: Some(trace_id),
                }),
            }
        }
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
    ws_id: &str,
    name: &str,
    args: Value,
    arming: bool,
    trace_id: &str,
    timeout: Duration,
) -> Result<Value> {
    let request = CommandRequest {
        protocol_version: "v1".to_string(),
        trace_id: trace_id.to_string(),
        ts_ms: now_ms(),
        name: name.to_string(),
        args: args.clone(),
        arming,
    };

    let req = map_request(&request.name, request.args.clone())?;
    let mut stream =
        UnixStream::connect(sock).with_context(|| format!("connect control socket: {sock}"))?;
    stream.set_read_timeout(Some(timeout)).ok();
    stream.set_write_timeout(Some(timeout)).ok();

    let envelope = if arming {
        json!({ "v": RPC_PROTOCOL_VERSION, "request": req, "ws_id": ws_id, "arming": true, "role": "operator" })
    } else {
        json!({ "v": RPC_PROTOCOL_VERSION, "request": req, "ws_id": ws_id, "arming": false })
    };
    let line = serde_json::to_string(&envelope)?;
    stream.write_all(line.as_bytes())?;
    stream.write_all(b"\n")?;
    stream.flush()?;

    let mut reader = BufReader::new(stream);
    let mut seen_lines = 0u8;
    while seen_lines < 8 {
        let mut resp = String::new();
        let n = reader.read_line(&mut resp)?;
        if n == 0 {
            return Err(anyhow!("empty response from daemon"));
        }
        seen_lines += 1;

        let parsed: Value = serde_json::from_str(resp.trim_end())
            .with_context(|| format!("invalid json response for trace_id={trace_id}"))?;

        let kind = parsed
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if kind == "error" {
            let msg = parsed
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("daemon error");
            return Err(anyhow!(msg.to_string()));
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
        "status" => json!({ "Status": {} }),

        "protocol.handshake" => {
            let client = args.get("client").and_then(Value::as_str);
            json!({ "ProtocolHandshake": { "client": client } })
        }

        "ping" => json!({ "Ping": {} }),

        "providers.discover" => {
            let endpoint = args
                .get("endpoint")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            let model = args
                .get("model")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            json!({ "ProvidersDiscover": { "endpoint": endpoint, "model": model } })
        }

        "providers.list" => json!({ "ProvidersList": {} }),
        "providers.status" => json!({ "ProvidersStatus": {} }),
        "providers.detach" => json!({ "ProvidersDetach": {} }),

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
            json!({ "ProvidersPair": { "id": id, "endpoint": endpoint, "model": model } })
        }

        "providers.attach" => {
            let id = args
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let model = args
                .get("model")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            json!({ "ProvidersAttach": { "id": id, "model": model } })
        }

        "providers.revoke" => {
            let id = args
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            json!({ "ProvidersRevoke": { "id": id } })
        }

        "events.subscribe" => json!({ "EventsSubscribe": {} }),

        "chat.sessions.list" => json!({ "ChatSessionsList": {} }),
        "chat.session.new" => {
            let title = args
                .get("title")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            json!({ "ChatSessionNew": { "title": title } })
        }
        "chat.history" => {
            let session_id = args
                .get("session_id")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            json!({ "ChatHistory": { "session_id": session_id } })
        }
        "chat.send" => {
            let session_id = args
                .get("session_id")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            let text = args
                .get("text")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let stream = args.get("stream").and_then(Value::as_bool).unwrap_or(true);
            json!({ "ChatSend": { "session_id": session_id, "text": text, "stream": stream } })
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
            let cwd = args
                .get("cwd")
                .and_then(Value::as_str)
                .map(|s| s.to_string());
            json!({ "ShellExec": { "cmd": cmd, "args": cmd_args, "cwd": cwd } })
        }

        "down" => {
            let force = args.get("force").and_then(Value::as_bool).unwrap_or(false);
            let shutdown = args
                .get("shutdown")
                .and_then(Value::as_bool)
                .unwrap_or(false);
            json!({ "Down": { "force": force, "shutdown": shutdown } })
        }

        _ => return Err(anyhow!("unsupported command: {name}")),
    };

    Ok(v)
}

#[cfg(unix)]
fn map_event(value: &Value) -> Option<ProtocolEvent> {
    let kind = value.get("type").and_then(Value::as_str)?;
    if kind != "event" {
        return None;
    }
    let event = value.get("event")?;
    let topic = event
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let severity = event.get("level").and_then(Value::as_str).unwrap_or("info");
    let ts_ms = event
        .get("ts")
        .and_then(Value::as_u64)
        .unwrap_or_else(now_ms);
    let payload = json!({
        "event_id": event.get("event_id"),
        "ws": event.get("ws"),
        "seq": event.get("seq"),
        "msg": event.get("msg"),
        "data": event.get("data"),
        "compliance": event.get("compliance"),
    });
    Some(ProtocolEvent {
        topic: topic.to_string(),
        severity: severity.to_string(),
        ts_ms,
        payload,
        trace_id: event
            .get("event_id")
            .and_then(Value::as_str)
            .map(|s| s.to_string()),
    })
}

#[cfg(unix)]
pub fn start_event_stream<F>(on_event: F) -> Result<()>
where
    F: Fn(ProtocolEvent) + Send + 'static,
{
    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = Arc::clone(&stop);
    std::thread::spawn(move || {
        while !stop_clone.load(Ordering::Relaxed) {
            let selected_ws = resolve_ws_preference();
            let socket_path = socket_path_for_ws(&selected_ws);
            let stream = UnixStream::connect(&socket_path);
            if stream.is_err() {
                std::thread::sleep(Duration::from_millis(1200));
                continue;
            }
            let mut stream = match stream {
                Ok(s) => s,
                Err(_) => continue,
            };
            let req = map_request("events.subscribe", json!({})).ok();
            if req.is_none() {
                std::thread::sleep(Duration::from_millis(1200));
                continue;
            }
            let envelope = json!({ "v": RPC_PROTOCOL_VERSION, "request": req.unwrap(), "arming": false });
            if let Ok(line) = serde_json::to_string(&envelope) {
                let _ = stream.write_all(line.as_bytes());
                let _ = stream.write_all(b"\n");
                let _ = stream.flush();
            }
            let mut reader = BufReader::new(stream);
            loop {
                if stop_clone.load(Ordering::Relaxed) {
                    break;
                }
                let mut resp = String::new();
                let n = reader.read_line(&mut resp);
                if n.is_err() || n.ok() == Some(0) {
                    break;
                }
                if resolve_ws_preference() != selected_ws {
                    break;
                }
                let parsed: Value = match serde_json::from_str(resp.trim_end()) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if let Some(ev) = map_event(&parsed) {
                    on_event(ev);
                }
            }
            std::thread::sleep(Duration::from_millis(1200));
        }
    });
    Ok(())
}

#[cfg(not(unix))]
pub fn start_event_stream<F>(_on_event: F) -> Result<()>
where
    F: Fn(ProtocolEvent) + Send + 'static,
{
    Err(anyhow!("real mode requires unix sockets"))
}
