#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod shortcuts;
mod tray;
mod window;

fn main() {
    tauri::Builder::default()
        .system_tray(tray::build_tray())
        .on_system_tray_event(tray::handle_tray_event)
        .setup(|app| {
            shortcuts::register_default_shortcuts(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_api_key,
            commands::set_api_key,
            commands::delete_api_key,
            shortcuts::register_shortcut,
            shortcuts::unregister_shortcut,
            window::show_app_window,
            window::hide_app_window,
            window::center_app_window
        ])
        .run(tauri::generate_context!())
        .expect("failed to run WorkBuddy");
}

