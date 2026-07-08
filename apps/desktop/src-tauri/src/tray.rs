use tauri::{CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu};

pub fn build_tray() -> SystemTray {
    let show_chat = CustomMenuItem::new("show_chat".to_string(), "Open Chat");
    let show_settings = CustomMenuItem::new("show_settings".to_string(), "Open Settings");
    let toggle_pet = CustomMenuItem::new("toggle_pet".to_string(), "Hide / Show Pet");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit WorkBuddy");

    let menu = SystemTrayMenu::new()
        .add_item(show_chat)
        .add_item(show_settings)
        .add_item(toggle_pet)
        .add_item(quit);

    SystemTray::new().with_menu(menu)
}

pub fn handle_tray_event(app: &tauri::AppHandle, event: SystemTrayEvent) {
    if let SystemTrayEvent::DoubleClick { .. } = event {
        show_main_window(app);
        let _ = app.emit_all("workbuddy://tray", "showPet");
        return;
    }

    let SystemTrayEvent::MenuItemClick { id, .. } = event else {
        return;
    };

    match id.as_str() {
        "show_chat" => {
            let _ = app.emit_all("workbuddy://tray", "showChat");
            if let Some(window) = app.get_window("main") {
                show_window_without_taskbar(&window);
            }
        }
        "show_settings" => {
            let _ = app.emit_all("workbuddy://tray", "showSettings");
        }
        "toggle_pet" => {
            if let Some(window) = app.get_window("main") {
                if window.is_visible().unwrap_or(true) {
                    let _ = window.set_skip_taskbar(true);
                    let _ = window.hide();
                } else {
                    show_window_without_taskbar(&window);
                    let _ = app.emit_all("workbuddy://tray", "showPet");
                }
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_window("main") {
        show_window_without_taskbar(&window);
    }
}

fn show_window_without_taskbar(window: &tauri::Window) {
    let _ = window.set_skip_taskbar(true);
    let _ = window.show();
    let _ = window.set_focus();
}
