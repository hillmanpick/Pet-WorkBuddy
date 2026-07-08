use std::{
    env,
    path::{Path, PathBuf},
    process::Command,
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
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
    CreateWordDocument { app: String, text: String },
    OpenUrl { url: String },
    SetClipboard { text: String },
    PasteText { text: String },
    ShellCommand { command: String },
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
        match run_action(action) {
            Ok(message) => results.push(ComputerActionResult {
                index,
                ok: true,
                message,
            }),
            Err(error) => {
                results.push(ComputerActionResult {
                    index,
                    ok: false,
                    message: format!("Step {} failed: {}", index + 1, error),
                });
                break;
            }
        }
    }

    Ok(results)
}

fn run_action(action: ComputerAction) -> Result<String, String> {
    match action {
        ComputerAction::OpenApp { app } => open_app(&app),
        ComputerAction::OpenFolder { folder } => open_folder(&folder),
        ComputerAction::OrganizeFolder { folder } => organize_folder(&folder),
        ComputerAction::CreateWordDocument { app, text } => create_word_document(&app, &text),
        ComputerAction::OpenUrl { url } => open_url(&url),
        ComputerAction::SetClipboard { text } => set_clipboard_text(&text),
        ComputerAction::PasteText { text } => paste_text(&text),
        ComputerAction::ShellCommand { command } => run_shell_command(&command),
        ComputerAction::Hotkey { keys } => press_hotkey(&keys),
        ComputerAction::Key { key } => press_key(&key),
        ComputerAction::Wait { ms } => {
            thread::sleep(Duration::from_millis(ms.min(10_000)));
            Ok(format!("waited {}ms", ms.min(10_000)))
        }
    }
}

fn open_app(app: &str) -> Result<String, String> {
    match app.trim().to_ascii_lowercase().as_str() {
        "wechat" => open_wechat(),
        "wps" | "wps_writer" => open_wps_writer(),
        "word" | "winword" => open_word(),
        "explorer" => spawn_program("explorer.exe"),
        "notepad" => spawn_program("notepad.exe"),
        "calculator" => spawn_program("calc.exe"),
        "paint" => spawn_program("mspaint.exe"),
        "settings" => open_system_uri("ms-settings:"),
        "screenshot" => open_system_uri("ms-screenclip:").or_else(|_| spawn_program("SnippingTool.exe")),
        value => Err(format!("Unsupported app '{}'.", value)),
    }
}

fn open_url(url: &str) -> Result<String, String> {
    let trimmed = url.trim();
    let lower = trimmed.to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err("Only http:// and https:// URLs are allowed.".to_string());
    }

    let script = format!("Start-Process -FilePath {}", powershell_single_quoted(trimmed));
    if let Ok(output) = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
        .output()
    {
        if output.status.success() {
            return Ok(format!("requested default browser to open {}", trimmed));
        }
    }

    if Command::new("cmd")
        .args(["/C", "start", "", trimmed])
        .spawn()
        .is_ok()
    {
        return Ok(format!("requested default browser to open {}", trimmed));
    }

    Command::new("explorer")
        .arg(trimmed)
        .spawn()
        .map(|_| format!("requested default browser to open {}", trimmed))
        .map_err(|error| error.to_string())
}

fn powershell_single_quoted(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn open_folder(folder: &str) -> Result<String, String> {
    let folder_path = folder_path(folder)?;
    Command::new("explorer")
        .arg(&folder_path)
        .spawn()
        .map(|_| format!("opened {}", folder_path.display()))
        .map_err(|error| error.to_string())
}

fn organize_folder(folder: &str) -> Result<String, String> {
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

    Ok(format!("organized {} files", moved))
}

fn create_word_document(app: &str, text: &str) -> Result<String, String> {
    if text.chars().count() > 20_000 {
        return Err("Document text is too long.".to_string());
    }

    let documents = folder_path("documents")?;
    let target_dir = documents.join("WorkBuddy Documents");
    std::fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_secs();
    let target = unique_target_path(&target_dir.join(format!("WorkBuddy-{timestamp}.doc")));
    std::fs::write(&target, word_compatible_html(text)).map_err(|error| error.to_string())?;

    open_word_document_with_app(app, &target)?;
    Ok(format!("created {}", target.display()))
}

fn word_compatible_html(text: &str) -> String {
    let body = if text.trim().is_empty() {
        "<p>&nbsp;</p>".to_string()
    } else {
        text.lines()
            .map(|line| format!("<p>{}</p>", escape_html(line)))
            .collect::<Vec<_>>()
            .join("\n")
    };

    format!(
        r#"<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>WorkBuddy Document</title>
</head>
<body>
{body}
</body>
</html>
"#
    )
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn open_word_document_with_app(app: &str, path: &Path) -> Result<String, String> {
    match app.trim().to_ascii_lowercase().as_str() {
        "wps" | "wps_writer" => {
            for candidate in wps_candidates() {
                if candidate.exists() && spawn_path_with_arg(&candidate, path).is_ok() {
                    return Ok(format!("opened {}", path.display()));
                }
            }
        }
        "word" | "winword" => {
            for candidate in word_candidates() {
                if candidate.exists() && spawn_path_with_arg(&candidate, path).is_ok() {
                    return Ok(format!("opened {}", path.display()));
                }
            }
        }
        _ => {}
    }

    open_path_with_explorer(path)
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

fn open_wechat() -> Result<String, String> {
    for path in wechat_candidates() {
        if path.exists() {
            return spawn_path(&path);
        }
    }

    if let Ok(message) = spawn_program("WeChat.exe").or_else(|_| spawn_program("Weixin.exe")) {
        return Ok(message);
    }

    if let Ok(message) = open_start_menu_shortcut(&["微信", "wechat", "weixin"]) {
        return Ok(message);
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

fn open_wps_writer() -> Result<String, String> {
    for path in wps_candidates() {
        if path.exists() {
            return spawn_path(&path);
        }
    }

    if let Ok(message) = spawn_program("wps.exe") {
        return Ok(message);
    }

    open_start_menu_shortcut(&["wps", "金山"]).map_err(|error| format!("Could not open WPS: {}", error))
}

fn wps_candidates() -> Vec<PathBuf> {
    let mut paths = vec![
        PathBuf::from(r"D:\WPS Office\office6\wps.exe"),
        PathBuf::from(r"C:\Program Files\Kingsoft\WPS Office\office6\wps.exe"),
        PathBuf::from(r"C:\Program Files (x86)\Kingsoft\WPS Office\office6\wps.exe"),
    ];

    for root in [
        r"D:\WPS Office",
        r"C:\Program Files\Kingsoft\WPS Office",
        r"C:\Program Files (x86)\Kingsoft\WPS Office",
    ] {
        collect_named_files(Path::new(root), "wps.exe", 5, &mut paths);
    }

    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        let root = PathBuf::from(&local_app_data).join(r"Kingsoft\WPS Office");
        paths.push(root.join(r"office6\wps.exe"));
        collect_named_files(&root, "wps.exe", 5, &mut paths);
    }

    paths.sort_by(|a, b| b.to_string_lossy().cmp(&a.to_string_lossy()));
    paths.dedup();
    paths
}

fn open_word() -> Result<String, String> {
    for path in word_candidates() {
        if path.exists() {
            return spawn_path(&path);
        }
    }

    if let Ok(message) = spawn_program("winword.exe") {
        return Ok(message);
    }

    open_start_menu_shortcut(&["word"]).map_err(|error| format!("Could not open Word: {}", error))
}

fn word_candidates() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for root in [
        r"C:\Program Files\Microsoft Office",
        r"C:\Program Files (x86)\Microsoft Office",
    ] {
        collect_named_files(Path::new(root), "winword.exe", 7, &mut paths);
    }
    paths
}

fn open_start_menu_shortcut(keywords: &[&str]) -> Result<String, String> {
    let mut shortcuts = Vec::new();

    if let Ok(app_data) = env::var("APPDATA") {
        shortcuts.push(PathBuf::from(app_data).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    if let Ok(program_data) = env::var("PROGRAMDATA") {
        shortcuts.push(PathBuf::from(program_data).join(r"Microsoft\Windows\Start Menu\Programs"));
    }

    for root in shortcuts {
        if let Some(shortcut) = find_shortcut(&root, keywords, 6) {
            return open_path_with_explorer(&shortcut);
        }
    }

    Err(format!("No Start Menu shortcut matched {:?}.", keywords))
}

fn find_shortcut(root: &Path, keywords: &[&str], max_depth: usize) -> Option<PathBuf> {
    let mut stack = vec![(root.to_path_buf(), 0usize)];
    while let Some((path, depth)) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&path) else {
            continue;
        };
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_dir() {
                if depth < max_depth {
                    stack.push((entry_path, depth + 1));
                }
                continue;
            }

            if entry_path.extension().and_then(|value| value.to_str()) != Some("lnk") {
                continue;
            }

            let name = entry_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("")
                .to_lowercase();
            if keywords.iter().any(|keyword| name.contains(&keyword.to_lowercase())) {
                return Some(entry_path);
            }
        }
    }

    None
}

fn collect_named_files(root: &Path, file_name: &str, max_depth: usize, found: &mut Vec<PathBuf>) {
    if found.len() >= 12 || !root.exists() {
        return;
    }

    let Ok(entries) = std::fs::read_dir(root) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && max_depth > 0 {
            collect_named_files(&path, file_name, max_depth - 1, found);
        } else if path
            .file_name()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case(file_name))
            .unwrap_or(false)
        {
            found.push(path);
        }
    }
}

fn spawn_program(program: &str) -> Result<String, String> {
    Command::new(program)
        .spawn()
        .map(|_| format!("started {}", program))
        .map_err(|error| error.to_string())
}

fn spawn_path(path: &Path) -> Result<String, String> {
    Command::new(path)
        .spawn()
        .map(|_| format!("started {}", path.display()))
        .map_err(|error| error.to_string())
}

fn spawn_path_with_arg(path: &Path, arg: &Path) -> Result<String, String> {
    Command::new(path)
        .arg(arg)
        .spawn()
        .map(|_| format!("started {} {}", path.display(), arg.display()))
        .map_err(|error| error.to_string())
}

fn open_path_with_explorer(path: &Path) -> Result<String, String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| format!("opened {}", path.display()))
        .map_err(|error| error.to_string())
}

fn open_system_uri(uri: &str) -> Result<String, String> {
    Command::new("explorer")
        .arg(uri)
        .spawn()
        .map(|_| format!("opened {}", uri))
        .map_err(|error| error.to_string())
}

fn set_clipboard_text(text: &str) -> Result<String, String> {
    if text.chars().count() > 4000 {
        return Err("Text is too long to copy safely.".to_string());
    }

    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    clipboard
        .set_text(text.to_string())
        .map(|_| "set clipboard".to_string())
        .map_err(|error| error.to_string())
}

fn paste_text(text: &str) -> Result<String, String> {
    let _ = set_clipboard_text(text)?;
    thread::sleep(Duration::from_millis(80));
    let _ = press_hotkey(&["ctrl".to_string(), "v".to_string()])?;
    Ok("pasted text".to_string())
}

fn run_shell_command(command: &str) -> Result<String, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("Shell command is empty.".to_string());
    }
    if trimmed.chars().count() > 4000 {
        return Err("Shell command is too long.".to_string());
    }

    let output = Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", trimmed])
        .output()
        .map_err(|error| error.to_string())?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = [stdout.as_str(), stderr.as_str()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    let message = if combined.chars().count() > 1600 {
        format!("{}...", combined.chars().take(1600).collect::<String>())
    } else if combined.is_empty() {
        "shell command completed".to_string()
    } else {
        combined
    };

    if output.status.success() {
        Ok(message)
    } else {
        Err(message)
    }
}

fn press_hotkey(keys: &[String]) -> Result<String, String> {
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

    Ok(format!("pressed {}", keys.join("+")))
}

fn press_key(key: &str) -> Result<String, String> {
    let mut enigo = create_enigo()?;
    enigo
        .key(parse_key(key)?, Direction::Click)
        .map(|_| format!("pressed {}", key))
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
