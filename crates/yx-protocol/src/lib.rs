use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub protocol_version: String,
    pub kind: String,
    pub ts_ms: u64,
    pub trace_id: Option<String>,
    pub payload: Value,
}
