use serde::Serialize;
use serde_json::{json, Value};
use std::{
    fs::{self, File},
    io,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use zip::ZipArchive;

const MAX_SINGLE_MODEL_BYTES: u64 = 120 * 1024 * 1024;
const MAX_ZIP_BYTES: u64 = 220 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: u64 = 260 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomPetPackEntry {
    id: String,
    path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPetPackResult {
    id: String,
    path: String,
}

#[tauri::command]
pub fn list_custom_pet_packs(app: tauri::AppHandle) -> Result<Vec<CustomPetPackEntry>, String> {
    let root = custom_pets_root(&app)?;
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut pets = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("pet.json");
        let Ok(id) = read_pet_id(&manifest_path) else {
            continue;
        };
        pets.push(CustomPetPackEntry {
            id,
            path: manifest_path.display().to_string(),
        });
    }

    pets.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(pets)
}

#[tauri::command]
pub fn import_pet_pack(
    app: tauri::AppHandle,
    source_path: String,
) -> Result<ImportPetPackResult, String> {
    let source = fs::canonicalize(PathBuf::from(source_path)).map_err(|error| error.to_string())?;
    if !source.is_file() {
        return Err("Selected path is not a file.".to_string());
    }

    let metadata = fs::metadata(&source).map_err(|error| error.to_string())?;
    let extension = extension_of(&source);
    if extension == "zip" {
        if metadata.len() > MAX_ZIP_BYTES {
            return Err("Pet package is larger than 220 MB.".to_string());
        }
        import_zip_pet_pack(&app, &source)
    } else if matches!(extension.as_str(), "glb" | "gltf" | "vrm") {
        if metadata.len() > MAX_SINGLE_MODEL_BYTES {
            return Err("Model file is larger than 120 MB.".to_string());
        }
        import_single_model_pet_pack(&app, &source, &extension)
    } else if matches!(extension.as_str(), "gif" | "png" | "jpg" | "jpeg" | "webp") {
        if metadata.len() > MAX_SINGLE_MODEL_BYTES {
            return Err("Sprite file is larger than 120 MB.".to_string());
        }
        import_single_sprite_pet_pack(&app, &source, &extension)
    } else {
        Err(
            "Please choose a .glb, .vrm, .gltf, .gif, .png, .jpg, .webp, or .zip pet package."
                .to_string(),
        )
    }
}

#[tauri::command]
pub fn delete_custom_pet_pack(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let root = custom_pets_root(&app)?;
    if !root.exists() {
        return Ok(());
    }

    let root = fs::canonicalize(root).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let manifest_path = path.join("pet.json");
        let Ok(pet_id) = read_pet_id(&manifest_path) else {
            continue;
        };
        if pet_id != id {
            continue;
        }

        let target = fs::canonicalize(&path).map_err(|error| error.to_string())?;
        if !target.starts_with(&root) {
            return Err(
                "Refusing to delete a pet pack outside the custom pet directory.".to_string(),
            );
        }

        fs::remove_dir_all(target).map_err(|error| error.to_string())?;
        return Ok(());
    }

    Ok(())
}

fn import_single_model_pet_pack(
    app: &tauri::AppHandle,
    source: &Path,
    extension: &str,
) -> Result<ImportPetPackResult, String> {
    let root = custom_pets_root(app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let name = title_from_stem(source);
    let id = unique_custom_id(&name);
    let target_dir = root.join(&id);
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

    let model_name = format!("model.{extension}");
    fs::copy(source, target_dir.join(&model_name)).map_err(|error| error.to_string())?;

    let pack = json!({
        "id": id,
        "name": name,
        "source": "User import",
        "type": if extension == "vrm" { "vrm" } else { "gltf" },
        "model": model_name,
        "scale": 1.0,
        "defaultAnimation": "idle",
        "animations": default_animations(),
        "events": default_events()
    });

    let manifest_path = target_dir.join("pet.json");
    write_pretty_json(&manifest_path, &pack)?;
    Ok(ImportPetPackResult {
        id,
        path: manifest_path.display().to_string(),
    })
}

fn import_single_sprite_pet_pack(
    app: &tauri::AppHandle,
    source: &Path,
    extension: &str,
) -> Result<ImportPetPackResult, String> {
    let root = custom_pets_root(app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let name = title_from_stem(source);
    let id = unique_custom_id(&name);
    let target_dir = root.join(&id);
    fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

    let sprite_name = format!("sprite.{extension}");
    fs::copy(source, target_dir.join(&sprite_name)).map_err(|error| error.to_string())?;

    let pack = json!({
        "id": id,
        "name": name,
        "source": "User import",
        "type": "sprite",
        "model": sprite_name,
        "preview": sprite_name,
        "scale": 1.0,
        "defaultAnimation": "idle",
        "animations": {
            "idle": { "file": sprite_name, "loop": true },
            "walk": { "file": sprite_name, "loop": true },
            "run": { "file": sprite_name, "loop": true },
            "happy": { "file": sprite_name, "loop": true },
            "positive": { "file": sprite_name, "loop": true },
            "negative": { "file": sprite_name, "loop": true },
            "rest": { "file": sprite_name, "loop": true }
        },
        "events": default_events()
    });

    let manifest_path = target_dir.join("pet.json");
    write_pretty_json(&manifest_path, &pack)?;
    Ok(ImportPetPackResult {
        id,
        path: manifest_path.display().to_string(),
    })
}

fn import_zip_pet_pack(
    app: &tauri::AppHandle,
    source: &Path,
) -> Result<ImportPetPackResult, String> {
    let root = custom_pets_root(app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let temp_dir = root.join(format!(".importing-{}", timestamp_millis()));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let result = (|| {
        extract_zip_safely(source, &temp_dir)?;
        let manifest_path = find_pet_manifest(&temp_dir)
            .ok_or_else(|| "Pet package must contain a pet.json file.".to_string())?;
        let manifest_parent = manifest_path
            .parent()
            .ok_or_else(|| "Invalid pet.json location.".to_string())?;
        let mut pack = read_pet_pack_json(&manifest_path)?;
        let name = pack
            .get("name")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| title_from_stem(source));
        let id = unique_custom_id(&name);
        normalize_pet_pack_json(&mut pack, &id, &name, manifest_parent)?;

        let target_dir = root.join(&id);
        copy_dir_contents(manifest_parent, &target_dir).map_err(|error| error.to_string())?;
        let target_manifest = target_dir.join("pet.json");
        write_pretty_json(&target_manifest, &pack)?;

        Ok(ImportPetPackResult {
            id,
            path: target_manifest.display().to_string(),
        })
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    result
}

fn extract_zip_safely(source: &Path, target_dir: &Path) -> Result<(), String> {
    let file = File::open(source).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    let mut total_size = 0u64;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let enclosed = entry
            .enclosed_name()
            .map(Path::to_path_buf)
            .ok_or_else(|| "Pet package contains an unsafe path.".to_string())?;
        ensure_safe_relative_path(&enclosed)?;

        if entry.is_dir() {
            fs::create_dir_all(target_dir.join(enclosed)).map_err(|error| error.to_string())?;
            continue;
        }

        ensure_allowed_asset(&enclosed)?;
        total_size = total_size.saturating_add(entry.size());
        if total_size > MAX_EXTRACTED_BYTES {
            return Err("Extracted pet package is larger than 260 MB.".to_string());
        }

        let output_path = target_dir.join(enclosed);
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(&output_path).map_err(|error| error.to_string())?;
        io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn normalize_pet_pack_json(
    pack: &mut Value,
    id: &str,
    name: &str,
    base_dir: &Path,
) -> Result<(), String> {
    let object = pack
        .as_object_mut()
        .ok_or_else(|| "pet.json must be a JSON object.".to_string())?;

    let model = object
        .get("model")
        .and_then(Value::as_str)
        .ok_or_else(|| "pet.json must contain a model field.".to_string())?
        .to_string();
    let model_path = PathBuf::from(&model);
    ensure_safe_relative_path(&model_path)?;
    if !base_dir.join(&model_path).is_file() {
        return Err(format!("pet.json references a missing model file: {model}"));
    }

    if let Some(preview) = object.get("preview").and_then(Value::as_str) {
        let preview_path = PathBuf::from(preview);
        ensure_safe_relative_path(&preview_path)?;
        if !base_dir.join(preview_path).is_file() {
            object.remove("preview");
        }
    }

    object.insert("id".to_string(), json!(id));
    object.insert("name".to_string(), json!(name));
    if !object.contains_key("source") {
        object.insert("source".to_string(), json!("User import"));
    }
    if !object.contains_key("type") {
        let model_extension = model
            .rsplit('.')
            .next()
            .map(|value| value.to_ascii_lowercase())
            .unwrap_or_default();
        object.insert(
            "type".to_string(),
            json!(if model_extension == "vrm" {
                "vrm"
            } else {
                "gltf"
            }),
        );
    }
    if !object.contains_key("scale") {
        object.insert("scale".to_string(), json!(1.0));
    }
    if !object.contains_key("defaultAnimation") {
        object.insert("defaultAnimation".to_string(), json!("idle"));
    }
    if !object.contains_key("animations") {
        object.insert("animations".to_string(), default_animations());
    }
    if !object.contains_key("events") {
        object.insert("events".to_string(), default_events());
    }

    Ok(())
}

fn read_pet_pack_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&text).map_err(|error| error.to_string())
}

fn read_pet_id(path: &Path) -> Result<String, String> {
    let value = read_pet_pack_json(path)?;
    value
        .get("id")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| "pet.json does not contain an id.".to_string())
}

fn write_pretty_json(path: &Path, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

fn find_pet_manifest(root: &Path) -> Option<PathBuf> {
    let direct = root.join("pet.json");
    if direct.is_file() {
        return Some(direct);
    }

    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((path, depth)) = stack.pop() {
        if depth > 4 {
            continue;
        }
        let Ok(entries) = fs::read_dir(path) else {
            continue;
        };
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                stack.push((entry_path, depth + 1));
            } else if entry_path
                .file_name()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("pet.json"))
            {
                return Some(entry_path);
            }
        }
    }

    None
}

fn copy_dir_contents(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let source = entry.path();
        let target = to.join(entry.file_name());
        if source.is_dir() {
            copy_dir_contents(&source, &target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source, &target)?;
        }
    }
    Ok(())
}

fn ensure_safe_relative_path(path: &Path) -> Result<(), String> {
    let mut has_normal = false;
    for component in path.components() {
        match component {
            Component::Normal(_) => has_normal = true,
            Component::CurDir => {}
            _ => return Err("Pet package contains an unsafe path.".to_string()),
        }
    }

    if has_normal {
        Ok(())
    } else {
        Err("Pet package contains an empty path.".to_string())
    }
}

fn ensure_allowed_asset(path: &Path) -> Result<(), String> {
    let extension = extension_of(path);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let allowed = matches!(
        extension.as_str(),
        "glb"
            | "gltf"
            | "vrm"
            | "bin"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "ktx2"
            | "json"
            | "txt"
            | "md"
    ) || file_name.starts_with("license")
        || file_name.starts_with("readme");

    if allowed {
        Ok(())
    } else {
        Err(format!(
            "Pet package contains an unsupported file type: {}",
            path.display()
        ))
    }
}

fn custom_pets_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path_resolver()
        .app_data_dir()
        .map(|path| path.join("pet-packs"))
        .ok_or_else(|| "Could not resolve WorkBuddy app data directory.".to_string())
}

fn extension_of(path: &Path) -> String {
    path.extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn title_from_stem(path: &Path) -> String {
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("My Pet");
    stem.replace(['_', '-'], " ")
        .split_whitespace()
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn unique_custom_id(name: &str) -> String {
    let slug = name
        .chars()
        .map(|value| {
            if value.is_ascii_alphanumeric() {
                value.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let slug = if slug.is_empty() {
        "pet"
    } else {
        slug.as_str()
    };
    format!("custom-{slug}-{}", timestamp_millis())
}

fn timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn default_animations() -> Value {
    json!({
        "idle": { "clip": "idle", "loop": true },
        "walk": { "clip": "walk", "loop": true },
        "run": { "clip": "run", "loop": true },
        "happy": { "clip": "dance", "loop": false },
        "positive": { "clip": "gesture-positive", "loop": false },
        "negative": { "clip": "gesture-negative", "loop": false },
        "rest": { "clip": "idle", "loop": true }
    })
}

fn default_events() -> Value {
    json!({
        "onClick": "happy",
        "onChatOpen": "positive",
        "onUserSendMessage": "idle",
        "onAiReplyStart": "positive",
        "onLongIdle": "rest"
    })
}
