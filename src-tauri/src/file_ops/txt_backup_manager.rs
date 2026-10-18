//! TextDiff generation and application, including legacy line patches.
use serde::{Deserialize, Serialize};
use similar::{DiffTag, TextDiff};

#[derive(Serialize, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct TextDelta {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    diff: Vec<TxtLinePatch>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    text_patches: Option<Vec<TxtTextPatch>>,
}
#[derive(Serialize, Deserialize)]
struct TxtTextPatch {
    byte_offset: usize,
    removed: String,
    inserted: String,
}

#[derive(Serialize, Deserialize)]
pub struct TxtLinePatch {
    #[serde(default)]
    line_number: usize,
    #[serde(default)]
    base_text: String,
    #[serde(default)]
    changed_text: String,
    #[serde(default)]
    is_deleted: bool,
}

pub fn diff(old_content: String, new_content: String) -> Result<TextDelta, String> {
    let diff = TextDiff::from_lines(&old_content, &new_content);
    let old_lines: Vec<&str> = diff.iter_old_slices().collect();
    let new_lines: Vec<&str> = diff.iter_new_slices().collect();
    let mut offsets = vec![0];
    for line in &old_lines {
        offsets.push(offsets.last().unwrap() + line.len());
    }
    let text_patches = diff
        .ops()
        .iter()
        .filter(|op| op.tag() != DiffTag::Equal)
        .map(|op| TxtTextPatch {
            byte_offset: offsets[op.old_range().start],
            removed: old_lines[op.old_range()].concat(),
            inserted: new_lines[op.new_range()].concat(),
        })
        .collect();
    Ok(TextDelta {
        diff: Vec::new(),
        text_patches: Some(text_patches),
    })
}

pub fn apply(base_content: &mut String, incremental_node: &TextDelta) -> Result<(), String> {
    if let Some(patches) = &incremental_node.text_patches {
        // Validate all ranges before changing the content.
        let mut previous_end = 0;
        for patch in patches {
            let end = patch
                .byte_offset
                .checked_add(patch.removed.len())
                .ok_or_else(|| "invalid text patch range".to_string())?;
            if patch.byte_offset < previous_end
                || base_content.get(patch.byte_offset..end) != Some(patch.removed.as_str())
            {
                return Err("text patch does not match backup content".to_string());
            }
            previous_end = end;
        }
        for patch in patches.iter().rev() {
            base_content.replace_range(
                patch.byte_offset..patch.byte_offset + patch.removed.len(),
                &patch.inserted,
            );
        }
        return Ok(());
    }
    // Backups created before TextDiff used positional lines without terminators.
    let mut lines: Vec<String> = base_content.lines().map(str::to_string).collect();
    apply_txt_incremental_node_to_lines(&mut lines, incremental_node)?;
    *base_content = lines.join("\n");
    Ok(())
}

fn apply_txt_incremental_node_to_lines(
    lines: &mut Vec<String>,
    incremental_node: &TextDelta,
) -> Result<(), String> {
    for line_patch in incremental_node.diff.iter().rev() {
        if line_patch.line_number == 0 {
            return Err("line_number must be greater than 0".to_string());
        }

        let line_index = line_patch.line_number - 1;

        if line_patch.is_deleted {
            if line_index < lines.len() {
                lines.remove(line_index);
            }
            continue;
        }

        if line_index >= lines.len() {
            lines.resize(line_index + 1, String::new());
        }
        lines[line_index] = line_patch.changed_text.clone();
    }

    Ok(())
}

impl TextDelta {
    pub fn is_empty(&self) -> bool {
        self.diff.is_empty() && self.text_patches.as_ref().is_none_or(Vec::is_empty)
    }
}
#[cfg(test)]
mod text_diff_tests {
    use super::*;

    #[test]
    fn round_trip_edits_preserve_exact_text() {
        let cases = [
            "",
            "\n",
            "a",
            "a\n",
            "a\r\nb\r\n",
            "\u{7f8a}\u{1f411}\n\n\u{7d42}",
            "\u{5148}\u{982d}\na\n\u{672b}\u{5c3e}\n",
        ];
        for old in cases {
            for new in cases {
                let node = diff(old.into(), new.into()).unwrap();
                let node: TextDelta =
                    serde_json::from_str(&serde_json::to_string(&node).unwrap()).unwrap();
                let mut restored = old.to_string();
                apply(&mut restored, &node).unwrap();
                assert_eq!(restored, new, "old={old:?}, new={new:?}");
            }
        }
    }

    #[test]
    fn insertion_is_a_single_patch_and_keeps_history() {
        let node = diff("a\nb\nc\n".into(), "a\nx\nb\nc\n".into()).unwrap();
        assert_eq!(node.text_patches.as_ref().unwrap().len(), 1);
    }

    #[test]
    fn legacy_patches_remain_readable() {
        let node: TextDelta = serde_json::from_str(
            r#"{"diff":[{"line_number":2,"base_text":"b","changed_text":"c","is_deleted":false}]}"#,
        )
        .unwrap();
        let mut content = "a\nb".to_string();
        apply(&mut content, &node).unwrap();
        assert_eq!(content, "a\nc");
        let next = diff(content.clone(), "a\nc\n".into()).unwrap();
        apply(&mut content, &next).unwrap();
        assert_eq!(content, "a\nc\n");
    }

    #[test]
    fn invalid_patch_leaves_content_unchanged() {
        let node = diff("\u{7f8a}".into(), "\u{732b}".into()).unwrap();
        let mut content = "\u{72ac}".to_string();
        assert!(apply(&mut content, &node).is_err());
        assert_eq!(content, "\u{72ac}");
    }
}
