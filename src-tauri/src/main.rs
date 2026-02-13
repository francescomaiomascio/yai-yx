use serde_json::{json, Value};
use std::time::Duration;
use tauri::Emitter;

#[tauri::command]
fn yx_workspaces_list() -> Result<Value, String> {
    serde_json::to_value(yx_client::workspaces_list()).map_err(|e| e.to_string())
}

#[tauri::command]
fn yx_workspace_select(ws: String) -> Result<Value, String> {
    std::env::set_var("YAI_WS", ws);
    serde_json::to_value(yx_client::connection_state()).map_err(|e| e.to_string())
}

#[tauri::command]
fn yx_connection_state() -> Result<Value, String> {
    serde_json::to_value(yx_client::connection_state()).map_err(|e| e.to_string())
}

#[tauri::command]
fn yx_ping() -> Result<Value, String> {
    serde_json::to_value(yx_client::ping_selected()).map_err(|e| e.to_string())
}

#[tauri::command]
fn yx_send_command(name: String, args: Value, arming: Option<bool>) -> Result<Value, String> {
    serde_json::to_value(yx_client::send_command(&name, args, arming.unwrap_or(false)))
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut tick = tokio::time::interval(Duration::from_secs(2));
                loop {
                    tick.tick().await;
                    let payload = json!({
                        "connection": yx_client::connection_state(),
                        "workspaces": yx_client::workspaces_list(),
                        "ping": yx_client::ping_selected(),
                    });
                    let _ = handle.emit("yx:connection", payload);
                }
            });
            let event_handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                let _ = yx_client::start_event_stream(move |event| {
                    let _ = event_handle.emit("yx:event", event);
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            yx_workspaces_list,
            yx_workspace_select,
            yx_connection_state,
            yx_ping,
            yx_send_command
        ])
        .run(tauri::generate_context!())
        .expect("run yx app");
}
