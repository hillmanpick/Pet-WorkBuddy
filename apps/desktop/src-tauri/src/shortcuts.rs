use tauri::{GlobalShortcutManager, Manager};

const SHORTCUT_EVENT: &str = "workbuddy://shortcut";

fn register_named_shortcut(
    app: &tauri::AppHandle,
    name: &str,
    accelerator: &str,
) -> Result<(), tauri::Error> {
    let event_name = name.to_string();
    let handle = app.clone();
    app.global_shortcut_manager().register(accelerator, move || {
        let _ = handle.emit_all(SHORTCUT_EVENT, event_name.clone());
    })
}

pub fn register_default_shortcuts(app: tauri::AppHandle) -> Result<(), tauri::Error> {
    let shortcuts = [
        ("toggleChat", "Ctrl+Alt+W"),
        ("hidePet", "Ctrl+Alt+H"),
        ("centerPet", "Ctrl+Alt+B"),
        ("quickAsk", "Ctrl+Alt+Space"),
    ];

    for (name, accelerator) in shortcuts {
        let _ = register_named_shortcut(&app, name, accelerator);
    }

    Ok(())
}

#[tauri::command]
pub fn register_shortcut(
    app: tauri::AppHandle,
    name: String,
    accelerator: String,
) -> Result<(), String> {
    register_named_shortcut(&app, &name, &accelerator).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn unregister_shortcut(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    app.global_shortcut_manager()
        .unregister(&accelerator)
        .map_err(|error| error.to_string())
}

