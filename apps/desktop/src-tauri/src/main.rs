#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_log;
mod commands;
mod computer_control;
mod custom_pets;
mod shortcuts;
mod single_instance;
mod startup;
mod tray;
mod window;

fn main() {
    app_log::init();
    let instance_guard = single_instance::acquire();
    if !instance_guard.is_primary() {
        app_log::write_line("Second instance detected; notifying primary instance");
        single_instance::notify_existing_instance();
        return;
    }

    tauri::Builder::default()
        .system_tray(tray::build_tray())
        .on_system_tray_event(tray::handle_tray_event)
        .setup(|app| {
            app_log::write_line("Tauri setup started");
            single_instance::listen_for_second_instance(app.handle());
            shortcuts::register_default_shortcuts(app.handle());
            app_log::write_line("Tauri setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_log::append_app_log,
            commands::get_api_key,
            commands::set_api_key,
            commands::delete_api_key,
            custom_pets::import_pet_pack,
            custom_pets::list_custom_pet_packs,
            custom_pets::delete_custom_pet_pack,
            computer_control::execute_computer_actions,
            startup::get_launch_on_startup,
            startup::set_launch_on_startup,
            shortcuts::register_shortcut,
            shortcuts::unregister_shortcut,
            window::show_app_window,
            window::hide_app_window,
            window::center_app_window,
            window::get_cursor_position,
            window::get_pointer_state,
            window::set_mouse_passthrough,
            window::is_foreground_fullscreen_app
        ])
        .run(tauri::generate_context!())
        .expect("failed to run WorkBuddy");

    drop(instance_guard);
}
