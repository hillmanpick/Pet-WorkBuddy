use tauri::{GlobalShortcutManager, Manager};

const SHORTCUT_EVENT: &str = "workbuddy://shortcut";

fn register_named_shortcut(
    app: &tauri::AppHandle,
    name: &str,
    accelerator: &str,
) -> Result<(), String> {
    if accelerator.trim().is_empty() {
        return Ok(());
    }

    let _ = app.global_shortcut_manager().unregister(accelerator);
    let event_name = name.to_string();
    let handle = app.clone();
    app.global_shortcut_manager()
        .register(accelerator, move || {
            let _ = handle.emit_all(SHORTCUT_EVENT, event_name.clone());
        })
        .map_err(|error| error.to_string())
}

pub fn register_default_shortcuts(app: tauri::AppHandle) {
    let shortcuts = [
        ("toggleChat", "Ctrl+Alt+W"),
        ("hidePet", "Ctrl+Alt+H"),
        ("centerPet", "Ctrl+Alt+B"),
        ("quickAsk", "Ctrl+Alt+Space"),
    ];

    for (name, accelerator) in shortcuts {
        let _ = register_named_shortcut(&app, name, accelerator);
    }
}

#[tauri::command]
pub fn register_shortcut(
    app: tauri::AppHandle,
    name: String,
    accelerator: String,
) -> Result<(), String> {
    register_named_shortcut(&app, &name, &accelerator)
}

#[tauri::command]
pub fn unregister_shortcut(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    app.global_shortcut_manager()
        .unregister(&accelerator)
        .map_err(|error| error.to_string())
}
