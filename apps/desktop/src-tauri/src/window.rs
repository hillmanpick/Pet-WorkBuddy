use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct CursorPosition {
    x: i32,
    y: i32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointerState {
    x: i32,
    y: i32,
    left_pressed: bool,
}

fn keep_main_window_out_of_taskbar(window: &tauri::Window) -> Result<(), String> {
    window.set_skip_taskbar(true).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn show_app_window(window: tauri::Window) -> Result<(), String> {
    keep_main_window_out_of_taskbar(&window)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn hide_app_window(window: tauri::Window) -> Result<(), String> {
    keep_main_window_out_of_taskbar(&window)?;
    window.hide().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn center_app_window(window: tauri::Window) -> Result<(), String> {
    keep_main_window_out_of_taskbar(&window)?;
    window.center().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_cursor_position() -> Result<CursorPosition, String> {
    platform_cursor_position()
}

#[tauri::command]
pub fn get_pointer_state() -> Result<PointerState, String> {
    platform_pointer_state()
}

#[cfg(windows)]
fn platform_cursor_position() -> Result<CursorPosition, String> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    let ok = unsafe { GetCursorPos(&mut point) };
    if ok == 0 {
        Err("Failed to read cursor position.".to_string())
    } else {
        Ok(CursorPosition {
            x: point.x,
            y: point.y,
        })
    }
}

#[cfg(windows)]
fn platform_pointer_state() -> Result<PointerState, String> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    let mut point = POINT { x: 0, y: 0 };
    let ok = unsafe { GetCursorPos(&mut point) };
    if ok == 0 {
        return Err("Failed to read pointer position.".to_string());
    }

    Ok(PointerState {
        x: point.x,
        y: point.y,
        left_pressed: unsafe { GetAsyncKeyState(0x01) & i16::MIN != 0 },
    })
}

#[cfg(not(windows))]
fn platform_cursor_position() -> Result<CursorPosition, String> {
    Err("Global cursor position is only implemented on Windows for now.".to_string())
}

#[cfg(not(windows))]
fn platform_pointer_state() -> Result<PointerState, String> {
    Err("Global pointer state is only implemented on Windows for now.".to_string())
}
