use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};

static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn init() {
    let path = log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    std::panic::set_hook(Box::new(|panic_info| {
        write_line(&format!("panic: {panic_info}"));
    }));

    write_line("WorkBuddy started");
}

#[tauri::command]
pub fn append_app_log(message: String) -> Result<(), String> {
    write_line(&message);
    Ok(())
}

pub fn write_line(message: &str) {
    let path = log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{timestamp}] {message}");
    }
}

fn log_path() -> &'static PathBuf {
    LOG_PATH.get_or_init(|| {
        let root = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .or_else(|| std::env::current_dir().ok())
            .unwrap_or_else(|| PathBuf::from("."));
        root.join("WorkBuddy").join("logs").join("workbuddy.log")
    })
}
