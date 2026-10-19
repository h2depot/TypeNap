//! Shared definitions live outside stories; private definitions exist only in a document stack.
//! Applied definitions are snapshots so library edits/deletion cannot invalidate saved values.
use super::{
    atomic_file,
    contents_info::ContentType,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{collections::HashSet, fs, path::Path, sync::Mutex};
use tauri::Manager;
use uuid::Uuid;

static TEMPLATE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Scope {
    Private,
    Character,
    Entity,
    World,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub enum FieldType {
    String,
    StringList,
    Number,
    Boolean,
    Select,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Field {
    pub id: String,
    pub label: String,
    #[serde(rename = "type")]
    pub kind: FieldType,
    #[serde(default)]
    pub options: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Definition {
    pub id: String,
    pub name: String,
    pub scope: Scope,
    pub revision: u32,
    pub fields: Vec<Field>,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub updated_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct StackEntry {
    pub definition: Definition,
    #[serde(default)]
    pub values: Map<String, Value>,
}

fn valid_id(id: &str) -> Result<(), String> {
    Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| "Invalid template or field ID".into())
}

fn matches_scope(scope: &Scope, kind: ContentType) -> bool {
    matches!(
        (scope, kind),
        (
            Scope::Private,
            ContentType::Character | ContentType::Entity | ContentType::World
        ) | (Scope::Character, ContentType::Character)
            | (Scope::Entity, ContentType::Entity)
            | (Scope::World, ContentType::World)
    )
}

fn validate_definition(definition: &Definition, shared: bool) -> Result<(), String> {
    valid_id(&definition.id)?;
    if shared && definition.scope == Scope::Private {
        return Err("Private templates cannot be shared".into());
    }
    if definition.name.trim().is_empty() || definition.revision == 0 {
        return Err("Template name and revision are required".into());
    }
    if definition.fields.len() > 200 {
        return Err("A template can contain at most 200 fields".into());
    }
    let mut ids = HashSet::new();
    for field in &definition.fields {
        valid_id(&field.id)?;
        if !ids.insert(&field.id) || field.label.trim().is_empty() {
            return Err("Fields require unique IDs and non-empty labels".into());
        }
        if field.kind == FieldType::Select
            && (field.options.is_empty()
                || field.options.iter().any(|option| option.trim().is_empty())
                || field.options.iter().collect::<HashSet<_>>().len() != field.options.len())
        {
            return Err("Select fields require unique, non-empty choices".into());
        }
    }
    Ok(())
}

fn valid_value(field: &Field, value: &Value) -> bool {
    value.is_null()
        || match field.kind {
            FieldType::String => value.is_string(),
            FieldType::StringList => value
                .as_array()
                .is_some_and(|items| items.iter().all(Value::is_string)),
            FieldType::Number => value.is_number(),
            FieldType::Boolean => value.is_boolean(),
            FieldType::Select => value.as_str().is_some_and(|text| {
                text.is_empty() || field.options.iter().any(|option| option == text)
            }),
        }
}

pub fn validate_document(content: &Value, kind: ContentType) -> Result<(), String> {
    let Some(stack) = content.get("templateStack") else {
        return Ok(());
    };
    let entries: Vec<StackEntry> =
        serde_json::from_value(stack.clone()).map_err(|error| error.to_string())?;
    if entries.len() > 100 {
        return Err("A document can contain at most 100 templates".into());
    }
    let mut ids = HashSet::new();
    for entry in entries {
        validate_definition(&entry.definition, false)?;
        if !matches_scope(&entry.definition.scope, kind) {
            return Err("Template scope does not match this document".into());
        }
        if !ids.insert(entry.definition.id) {
            return Err("A template can only occur once in a stack".into());
        }
        for (id, value) in entry.values {
            let field = entry
                .definition
                .fields
                .iter()
                .find(|field| field.id == id)
                .ok_or("Unknown template field")?;
            if !valid_value(field, &value) {
                return Err(format!("Invalid value for {}", field.label));
            }
        }
    }
    Ok(())
}

fn root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("templates"))
}

fn read_all(root: &Path) -> Result<Vec<Definition>, String> {
    if !root.exists() {
        return Ok(vec![]);
    }
    let mut definitions = vec![];
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }
        let definition: Definition =
            serde_json::from_str(&fs::read_to_string(path).map_err(|error| error.to_string())?)
                .map_err(|error| error.to_string())?;
        validate_definition(&definition, true)?;
        definitions.push(definition);
    }
    definitions.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(definitions)
}

fn write_definition(root: &Path, definition: &Definition) -> Result<(), String> {
    validate_definition(definition, true)?;
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    atomic_file::write_text_or_create(
        &root.join(format!("{}.json", definition.id)),
        &serde_json::to_string_pretty(definition).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

// Full snapshots keep original field IDs so restoring a removed field can recover
// document retiredValues. Persist history before modifying the live definition.
fn history(root: &Path, id: &str) -> Result<Vec<Definition>, String> {
    valid_id(id)?;
    let path = root.join("history").join(format!("{id}.json"));
    if !path.exists() { return Ok(vec![]); }
    let entries: Vec<Definition> = serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    for entry in &entries {
        validate_definition(entry, true)?;
        if entry.id != id { return Err("Invalid template history identity".into()); }
    }
    Ok(entries)
}

fn archive(root: &Path, definition: &Definition) -> Result<(), String> {
    let mut entries = history(root, &definition.id)?;
    if entries.contains(definition) { return Ok(()); }
    if entries.iter().any(|item| item.revision == definition.revision) {
        return Err("Template history revision already exists".into());
    }
    entries.push(definition.clone());
    let directory = root.join("history");
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    atomic_file::write_text_or_create(&directory.join(format!("{}.json", definition.id)),
        &serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_template_backups(app: tauri::AppHandle) -> Result<Vec<Definition>, String> {
    let _guard = TEMPLATE_LOCK.lock().map_err(|e| e.to_string())?;
    let root = root(&app)?;
    let directory = root.join("history");
    if !directory.exists() { return Ok(vec![]); }
    let mut entries = vec![];
    for file in fs::read_dir(directory).map_err(|e| e.to_string())? {
        let path = file.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") { continue; }
        let id = path.file_stem().and_then(|s| s.to_str()).ok_or("Invalid history path")?;
        entries.extend(history(&root, id)?);
    }
    entries.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then(b.revision.cmp(&a.revision)));
    Ok(entries)
}

fn restore_at(root: &Path, id: &str, revision: u32, expected_revision: Option<u32>) -> Result<Definition, String> {
    let entries = history(root, id)?;
    let mut restored = entries.iter().find(|entry| entry.revision == revision)
        .cloned().ok_or("Template backup not found")?;
    let current = read_all(root)?.into_iter().find(|item| item.id == id);
    if current.as_ref().map(|item| item.revision) != expected_revision {
        return Err("This template was changed elsewhere. Reload it before restoring.".into());
    }
    if let Some(current) = &current { archive(root, current)?; }
    restored.revision = entries.iter().map(|item| item.revision)
        .chain(current.iter().map(|item| item.revision)).max().unwrap_or(0)
        .checked_add(1).ok_or("Template revision limit reached")?;
    restored.updated_at = chrono::Utc::now().timestamp();
    archive(root, &restored)?;
    write_definition(root, &restored)?;
    Ok(restored)
}

#[tauri::command]
pub fn restore_template_backup(app: tauri::AppHandle, id: String, revision: u32, expected_revision: Option<u32>) -> Result<Definition, String> {
    let _guard = TEMPLATE_LOCK.lock().map_err(|e| e.to_string())?;
    restore_at(&root(&app)?, &id, revision, expected_revision)
}

#[tauri::command]
pub fn list_templates(app: tauri::AppHandle) -> Result<Vec<Definition>, String> {
    let _guard = TEMPLATE_LOCK.lock().map_err(|error| error.to_string())?;
    read_all(&root(&app)?)
}

#[tauri::command]
pub fn save_template(
    app: tauri::AppHandle,
    mut definition: Definition,
) -> Result<Definition, String> {
    let _guard = TEMPLATE_LOCK.lock().map_err(|error| error.to_string())?;
    let root = root(&app)?;
    validate_definition(&definition, true)?;
    if let Some(previous) = read_all(&root)?
        .iter()
        .find(|item| item.id == definition.id)
    {
        if definition.revision != previous.revision {
            return Err("This template was changed elsewhere. Reload it before saving.".into());
        }
        if definition.scope != previous.scope {
            return Err("An existing template's scope cannot be changed".into());
        }
        definition.revision = previous
            .revision
            .checked_add(1)
            .ok_or("Template revision limit reached")?;
        definition.created_at = previous.created_at;
        archive(&root, previous)?;
    } else {
        if definition.revision != 1 {
            return Err("Template no longer exists. Create a new template instead.".into());
        }
        definition.created_at = chrono::Utc::now().timestamp();
    }
    definition.updated_at = chrono::Utc::now().timestamp();
    // Failed writes may have reserved a revision in history; never reuse it.
    let highest = history(&root, &definition.id)?.iter().map(|item| item.revision).max().unwrap_or(0);
    if definition.revision <= highest {
        definition.revision = highest.checked_add(1).ok_or("Template revision limit reached")?;
    }
    archive(&root, &definition)?;
    write_definition(&root, &definition)?;
    Ok(definition)
}

#[tauri::command]
pub fn delete_template(app: tauri::AppHandle, id: String) -> Result<(), String> {
    valid_id(&id)?;
    let _guard = TEMPLATE_LOCK.lock().map_err(|error| error.to_string())?;
    let root = root(&app)?;
    let definition = read_all(&root)?.into_iter().find(|item| item.id == id).ok_or("Template not found")?;
    archive(&root, &definition)?;
    fs::remove_file(root.join(format!("{id}.json"))).map_err(|error| error.to_string())
}

pub fn initial_stack(
    app: &tauri::AppHandle,
    kind: ContentType,
    ids: &[String],
) -> Result<Value, String> {
    let definitions = list_templates(app.clone())?;
    let mut stack = vec![];
    for id in ids {
        let definition = definitions
            .iter()
            .find(|item| &item.id == id)
            .ok_or("Template not found")?;
        stack.push(StackEntry {
            definition: definition.clone(),
            values: Map::new(),
        });
    }
    let stack = serde_json::to_value(stack).map_err(|error| error.to_string())?;
    validate_document(&serde_json::json!({"templateStack": stack}), kind)?;
    Ok(stack)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn backups_restore_deleted_fields_and_templates_with_original_ids_and_new_revisions() {
        let root = std::env::temp_dir().join(format!("typenap-history-test-{}", Uuid::new_v4()));
        let original = definition(Scope::Character);
        archive(&root, &original).unwrap();
        write_definition(&root, &original).unwrap();
        let removed = Definition { revision: 2, fields: vec![], ..original.clone() };
        archive(&root, &removed).unwrap();
        write_definition(&root, &removed).unwrap();
        assert!(restore_at(&root, &original.id, 1, Some(1)).is_err());
        let restored = restore_at(&root, &original.id, 1, Some(2)).unwrap();
        assert_eq!(restored.revision, 3);
        assert_eq!(restored.fields, original.fields);
        assert_eq!(restored.id, original.id);
        fs::remove_file(root.join(format!("{}.json", original.id))).unwrap();
        assert!(restore_at(&root, &original.id, 1, Some(3)).is_err());
        let resurrected = restore_at(&root, &original.id, 1, None).unwrap();
        assert_eq!(resurrected.revision, 4);
        assert_eq!(resurrected.fields, original.fields);
        assert_eq!(read_all(&root).unwrap(), vec![resurrected]);
        assert_eq!(history(&root, &original.id).unwrap().len(), 4);
        fs::remove_dir_all(root).unwrap();
    }
    fn definition(scope: Scope) -> Definition {
        Definition {
            id: Uuid::new_v4().to_string(),
            name: "Profile".into(),
            scope,
            revision: 1,
            fields: vec![Field {
                id: Uuid::new_v4().to_string(),
                label: "Age".into(),
                kind: FieldType::Number,
                options: vec![],
            }],
            created_at: 0,
            updated_at: 0,
        }
    }
    #[test]
    fn shared_store_rejects_private_and_round_trips_typed_fields() {
        let root = std::env::temp_dir().join(format!("typenap-template-test-{}", Uuid::new_v4()));
        assert!(write_definition(&root, &definition(Scope::Private)).is_err());
        assert!(!root.exists());
        let shared = definition(Scope::Character);
        write_definition(&root, &shared).unwrap();
        assert_eq!(read_all(&root).unwrap(), vec![shared]);
        let mut updated = read_all(&root).unwrap().remove(0);
        updated.revision = 2;
        updated.fields[0].label = "Renamed age".into();
        write_definition(&root, &updated).unwrap();
        assert_eq!(read_all(&root).unwrap(), vec![updated]);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn stacks_enforce_scope_identity_and_value_types() {
        let shared = definition(Scope::Character);
        let id = shared.fields[0].id.clone();
        let entry = serde_json::json!({"definition": shared, "values": {id.clone(): 24}});
        let content = serde_json::json!({"templateStack": [entry.clone()]});
        assert!(validate_document(&content, ContentType::Character).is_ok());
        assert!(validate_document(&content, ContentType::World).is_err());
        assert!(validate_document(
            &serde_json::json!({"templateStack": [entry.clone(), entry]}),
            ContentType::Character
        )
        .is_err());
        let mut wrong = content;
        wrong["templateStack"][0]["values"][&id] = serde_json::json!("24");
        assert!(validate_document(&wrong, ContentType::Character).is_err());
        let private = serde_json::json!({"templateStack": [{"definition": definition(Scope::Private), "values": {}}]});
        assert!(validate_document(&private, ContentType::World).is_ok());
        assert!(validate_document(&private, ContentType::Txt).is_err());
        assert!(validate_document(
            &serde_json::json!({"properties": {"old": "kept"}}),
            ContentType::Character
        )
        .is_ok());
    }

}
