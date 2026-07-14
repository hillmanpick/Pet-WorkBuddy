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
    window
        .set_skip_taskbar(true)
        .map_err(|error| error.to_string())
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
pub fn set_mouse_passthrough(window: tauri::Window, enabled: bool) -> Result<(), String> {
    crate::app_log::write_line(&format!("set_mouse_passthrough:start enabled={enabled}"));
    let result = window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| error.to_string());
    crate::app_log::write_line(&format!(
        "set_mouse_passthrough:end enabled={enabled} ok={}",
        result.is_ok()
    ));
    result
}

#[tauri::command]
pub fn get_cursor_position() -> Result<CursorPosition, String> {
    platform_cursor_position()
}

#[tauri::command]
pub fn get_pointer_state() -> Result<PointerState, String> {
    platform_pointer_state()
}

#[tauri::command]
pub fn is_foreground_fullscreen_app(window: tauri::Window) -> Result<bool, String> {
    platform_is_foreground_fullscreen_app(&window)
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

#[cfg(windows)]
fn platform_is_foreground_fullscreen_app(window: &tauri::Window) -> Result<bool, String> {
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowRect, IsIconic, IsWindowVisible,
    };

    let foreground = unsafe { GetForegroundWindow() };
    if foreground.is_null() {
        return Ok(false);
    }

    if let Ok(raw_handle) = window.hwnd() {
        let own_hwnd = raw_handle.0 as HWND;
        if foreground == own_hwnd {
            return Ok(false);
        }
    }

    let visible = unsafe { IsWindowVisible(foreground) != 0 };
    let minimized = unsafe { IsIconic(foreground) != 0 };
    if !visible || minimized {
        return Ok(false);
    }

    let mut rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if unsafe { GetWindowRect(foreground, &mut rect) } == 0 {
        return Err("Failed to read foreground window bounds.".to_string());
    }

    let monitor = unsafe { MonitorFromWindow(foreground, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_null() {
        return Ok(false);
    }

    let mut monitor_info = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        rcMonitor: RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
        rcWork: RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        },
        dwFlags: 0,
    };
    if unsafe { GetMonitorInfoW(monitor, &mut monitor_info) } == 0 {
        return Err("Failed to read monitor bounds.".to_string());
    }

    let monitor_rect = monitor_info.rcMonitor;
    let tolerance = 3;
    let covers_monitor = rect.left <= monitor_rect.left + tolerance
        && rect.top <= monitor_rect.top + tolerance
        && rect.right >= monitor_rect.right - tolerance
        && rect.bottom >= monitor_rect.bottom - tolerance;

    Ok(covers_monitor)
}

#[cfg(not(windows))]
fn platform_cursor_position() -> Result<CursorPosition, String> {
    Err("Global cursor position is only implemented on Windows for now.".to_string())
}

#[cfg(not(windows))]
fn platform_pointer_state() -> Result<PointerState, String> {
    Err("Global pointer state is only implemented on Windows for now.".to_string())
}

#[cfg(not(windows))]
fn platform_is_foreground_fullscreen_app(_window: &tauri::Window) -> Result<bool, String> {
    Ok(false)
}
