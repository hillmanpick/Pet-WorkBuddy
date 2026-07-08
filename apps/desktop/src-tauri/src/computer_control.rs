use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::Duration,
};

use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ComputerAction {
    OpenApp { app: String },
    OpenFolder { folder: String },
    OrganizeFolder { folder: String },
    OpenUrl { url: String },
    SetClipboard { text: String },
    PasteText { text: String },
    Hotkey { keys: Vec<String> },
    Key { key: String },
    Wait { ms: u64 },
}

#[derive(Debug, Serialize)]
pub struct ComputerActionResult {
    index: usize,
    ok: bool,
    message: String,
}

#[tauri::command]
pub fn execute_computer_actions(
    actions: Vec<ComputerAction>,
) -> Result<Vec<ComputerActionResult>, String> {
    if actions.len() > 40 {
        return Err("Too many actions in one task.".to_string());
    }

    let mut results = Vec::with_capacity(actions.len());
    for (index, action) in actions.into_iter().enumerate() {
        run_action(action).map_err(|error| format!("Step {} failed: {}", index + 1, error))?;
        results.push(ComputerActionResult {
            index,
            ok: true,
            message: "ok".to_string(),
        });
    }

    Ok(results)
}

fn run_action(action: ComputerAction) -> Result<(), String> {
    match action {
        ComputerAction::OpenApp { app } => open_app(&app),
        ComputerAction::OpenFolder { folder } => open_folder(&folder),
        ComputerAction::OrganizeFolder { folder } => organize_folder(&folder),
        ComputerAction::OpenUrl { url } => open_url(&url),
        ComputerAction::SetClipboard { text } => set_clipboard_text(&text),
        ComputerAction::PasteText { text } => paste_text(&text),
        ComputerAction::Hotkey { keys } => press_hotkey(&keys),
        ComputerAction::Key { key } => press_key(&key),
        ComputerAction::Wait { ms } => {
            thread::sleep(Duration::from_millis(ms.min(10_000)));
            Ok(())
        }
    }
}

fn open_app(app: &str) -> Result<(), String> {
    match app.trim().to_ascii_lowercase().as_str() {
        "wechat" => open_wechat(),
        "explorer" => spawn_program("explorer.exe"),
        "notepad" => spawn_program("notepad.exe"),
        "calculator" => spawn_program("calc.exe"),
        "paint" => spawn_program("mspaint.exe"),
        "settings" => open_system_uri("ms-settings:"),
        "screenshot" => open_system_uri("ms-screenclip:").or_else(|_| spawn_program("SnippingTool.exe")),
        value => Err(format!("Unsupported app '{}'.", value)),
    }
}

fn open_url(url: &str) -> Result<(), String> {
    let trimmed = url.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err("Only http:// and https:// URLs are allowed.".to_string());
    }

    Command::new("explorer")
        .arg(trimmed)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn open_folder(folder: &str) -> Result<(), String> {
    let folder_path = folder_path(folder)?;
    Command::new("explorer")
        .arg(folder_path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn organize_folder(folder: &str) -> Result<(), String> {
    let source = folder_path(folder)?;
    if !source.exists() {
        return Err(format!("Folder does not exist: {}", source.display()));
    }

    let target_root = source.join("WorkBuddy Organized");
    std::fs::create_dir_all(&target_root).map_err(|error| error.to_string())?;

    let mut moved = 0usize;
    for entry in std::fs::read_dir(&source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if moved >= 500 {
            break;
        }
        if !path.is_file() {
            continue;
        }

        let category = file_category(&path);
        let category_dir = target_root.join(category);
        std::fs::create_dir_all(&category_dir).map_err(|error| error.to_string())?;

        let Some(file_name) = path.file_name() else {
            continue;
        };
        let target = unique_target_path(&category_dir.join(file_name));
        std::fs::rename(&path, &target).map_err(|error| error.to_string())?;
        moved += 1;
    }

    Ok(())
}

fn file_category(path: &Path) -> &'static str {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match extension.as_str() {
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" => "Documents",
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg" => "Images",
        "mp4" | "mov" | "avi" | "mkv" | "webm" => "Videos",
        "mp3" | "wav" | "flac" | "aac" | "m4a" => "Audio",
        "zip" | "rar" | "7z" | "tar" | "gz" => "Archives",
        "exe" | "msi" | "dmg" | "pkg" => "Installers",
        "js" | "ts" | "tsx" | "jsx" | "rs" | "py" | "go" | "java" | "cs" | "cpp" | "c" | "h"
        | "json" | "yaml" | "yml" | "toml" | "html" | "css" => "Code",
        _ => "Other",
    }
}

fn unique_target_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }

    let parent = target.parent().unwrap_or_else(|| Path::new("."));
    let stem = target
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = target.extension().and_then(|value| value.to_str());

    for index in 1..10_000 {
        let file_name = match extension {
            Some(extension) => format!("{} ({index}).{}", stem, extension),
            None => format!("{} ({index})", stem),
        };
        let candidate = parent.join(file_name);
        if !candidate.exists() {
            return candidate;
        }
    }

    target.to_path_buf()
}

fn folder_path(folder: &str) -> Result<PathBuf, String> {
    let home = env::var("USERPROFILE").map_err(|_| "USERPROFILE is unavailable.".to_string())?;
    let home = PathBuf::from(home);
    let normalized = folder.trim().to_ascii_lowercase();
    let path = match normalized.as_str() {
        "home" | "user" => home,
        "desktop" => home.join("Desktop"),
        "documents" | "docs" => home.join("Documents"),
        "downloads" => home.join("Downloads"),
        "pictures" | "photos" => home.join("Pictures"),
        "music" => home.join("Music"),
        "videos" => home.join("Videos"),
        value => return Err(format!("Unsupported folder '{}'.", value)),
    };
    Ok(path)
}

fn open_wechat() -> Result<(), String> {
    for path in wechat_candidates() {
        if path.exists() {
            return spawn_path(&path);
        }
    }

    if spawn_program("WeChat.exe").is_ok() || spawn_program("Weixin.exe").is_ok() {
        return Ok(());
    }

    open_system_uri("weixin://").map_err(|error| format!("Could not open WeChat: {}", error))
}

fn wechat_candidates() -> Vec<PathBuf> {
    let mut paths = vec![
        PathBuf::from(r"C:\Program Files\Tencent\WeChat\WeChat.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Tencent\WeChat\WeChat.exe"),
        PathBuf::from(r"C:\Program Files\Tencent\Weixin\Weixin.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Tencent\Weixin\Weixin.exe"),
    ];

    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        paths.push(PathBuf::from(&local_app_data).join(r"Programs\WeChat\WeChat.exe"));
        paths.push(PathBuf::from(local_app_data).join(r"Programs\Weixin\Weixin.exe"));
    }

    paths
}

fn spawn_program(program: &str) -> Result<(), String> {
    Command::new(program)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn spawn_path(path: &Path) -> Result<(), String> {
    Command::new(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn open_system_uri(uri: &str) -> Result<(), String> {
    Command::new("explorer")
        .arg(uri)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn set_clipboard_text(text: &str) -> Result<(), String> {
    if text.chars().count() > 4000 {
        return Err("Text is too long to copy safely.".to_string());
    }

    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(text.to_string())
        .map_err(|error| error.to_string())
}

fn paste_text(text: &str) -> Result<(), String> {
    set_clipboard_text(text)?;
    thread::sleep(Duration::from_millis(80));
    press_hotkey(&["ctrl".to_string(), "v".to_string()])
}

fn press_hotkey(keys: &[String]) -> Result<(), String> {
    if keys.is_empty() || keys.len() > 4 {
        return Err("Hotkey must contain between 1 and 4 keys.".to_string());
    }

    let mut enigo = create_enigo()?;
    let parsed = keys
        .iter()
        .map(|key| parse_key(key))
        .collect::<Result<Vec<_>, _>>()?;

    for key in &parsed {
        enigo
            .key(*key, Direction::Press)
            .map_err(|error| error.to_string())?;
    }
    for key in parsed.iter().rev() {
        enigo
            .key(*key, Direction::Release)
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn press_key(key: &str) -> Result<(), String> {
    let mut enigo = create_enigo()?;
    enigo
        .key(parse_key(key)?, Direction::Click)
        .map_err(|error| error.to_string())
}

fn create_enigo() -> Result<Enigo, String> {
    Enigo::new(&Settings::default()).map_err(|error| error.to_string())
}

fn parse_key(value: &str) -> Result<Key, String> {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "ctrl" | "control" => Ok(Key::Control),
        "shift" => Ok(Key::Shift),
        "alt" | "option" => Ok(Key::Alt),
        "meta" | "super" | "win" | "windows" | "cmd" => Ok(Key::Meta),
        "enter" | "return" => Ok(Key::Return),
        "tab" => Ok(Key::Tab),
        "esc" | "escape" => Ok(Key::Escape),
        "space" => Ok(Key::Space),
        "backspace" => Ok(Key::Backspace),
        "delete" | "del" => Ok(Key::Delete),
        "up" | "arrowup" => Ok(Key::UpArrow),
        "down" | "arrowdown" => Ok(Key::DownArrow),
        "left" | "arrowleft" => Ok(Key::LeftArrow),
        "right" | "arrowright" => Ok(Key::RightArrow),
        _ => {
            let mut chars = normalized.chars();
            match (chars.next(), chars.next()) {
                (Some(character), None) => Ok(Key::Unicode(character)),
                _ => Err(format!("Unsupported key '{}'.", value)),
            }
        }
    }
}
