use std::{
    env,
    process::{Command, Stdio},
};

const RUN_KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "WorkBuddy";

#[tauri::command]
pub fn get_launch_on_startup() -> Result<bool, String> {
    Ok(registry_value_exists())
}

#[tauri::command]
pub fn set_launch_on_startup(enabled: bool) -> Result<(), String> {
    if enabled {
        enable_startup()
    } else {
        disable_startup()
    }
}

fn enable_startup() -> Result<(), String> {
    let exe = env::current_exe().map_err(|error| error.to_string())?;
    let command = format!("\"{}\"", exe.display());
    let status = Command::new("reg")
        .args([
            "add", RUN_KEY, "/v", VALUE_NAME, "/t", "REG_SZ", "/d", &command, "/f",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Failed to enable launch on startup.".to_string())
    }
}

fn disable_startup() -> Result<(), String> {
    if !registry_value_exists() {
        return Ok(());
    }

    let status = Command::new("reg")
        .args(["delete", RUN_KEY, "/v", VALUE_NAME, "/f"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Failed to disable launch on startup.".to_string())
    }
}

fn registry_value_exists() -> bool {
    Command::new("reg")
        .args(["query", RUN_KEY, "/v", VALUE_NAME])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}
