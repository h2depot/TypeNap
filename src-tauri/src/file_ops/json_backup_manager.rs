//! JSON-specific RFC 6902 delta generation and replay. Storage belongs to backup_manager.
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct JsonDelta {
    json_patch: json_patch::Patch,
}

pub fn diff(old: String, new: String) -> Result<JsonDelta, String> {
    let old: Value = serde_json::from_str(&old).map_err(|e| e.to_string())?;
    let new: Value = serde_json::from_str(&new).map_err(|e| e.to_string())?;
    Ok(JsonDelta {
        json_patch: json_patch::diff(&old, &new),
    })
}

pub fn apply(content: &mut String, delta: &JsonDelta) -> Result<(), String> {
    let mut value: Value = serde_json::from_str(content).map_err(|e| e.to_string())?;
    json_patch::patch(&mut value, &delta.json_patch).map_err(|e| e.to_string())?;
    *content = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    Ok(())
}

impl JsonDelta {
    pub fn is_empty(&self) -> bool {
        self.json_patch.0.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_nested_arrays_escaped_keys_and_root_values() {
        let values = [
            serde_json::json!({"a/b": {"~key": [1, null, true]}, "name": "羊🐑"}),
            serde_json::json!({"a/b": {"~key": [2, false]}, "added": "new"}),
            serde_json::json!([1, {"nested": [3, 4]}, null]),
            serde_json::json!(null),
            serde_json::json!("文字列"),
        ];
        for old in &values {
            for new in &values {
                let mut content = old.to_string();
                let delta = diff(content.clone(), new.to_string()).unwrap();
                let delta: JsonDelta =
                    serde_json::from_str(&serde_json::to_string(&delta).unwrap()).unwrap();
                apply(&mut content, &delta).unwrap();
                assert_eq!(serde_json::from_str::<Value>(&content).unwrap(), *new);
            }
        }
        assert!(diff("{\"x\":1}".into(), "{ \"x\": 1 }".into())
            .unwrap()
            .is_empty());
        assert!(diff("broken".into(), "{}".into()).is_err());
    }

    #[test]
    fn failed_patch_does_not_change_content() {
        let delta: JsonDelta = serde_json::from_value(serde_json::json!({"json_patch": [
            {"op": "add", "path": "/added", "value": true},
            {"op": "remove", "path": "/missing"}
        ]}))
        .unwrap();
        let mut content = "{}".to_string();
        assert!(apply(&mut content, &delta).is_err());
        assert_eq!(content, "{}");
    }
}
