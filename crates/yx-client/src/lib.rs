use anyhow::Result;
use yx_protocol::Envelope;

pub fn parse_ndjson_line(line: &str) -> Result<Envelope> {
    Ok(serde_json::from_str(line)?)
}
