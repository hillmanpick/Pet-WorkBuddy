#[cfg(windows)]
use tauri::Manager;

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, HANDLE, WAIT_OBJECT_0},
    System::Threading::{
        CreateEventW, CreateMutexW, OpenEventW, SetEvent, WaitForSingleObject, EVENT_MODIFY_STATE,
        INFINITE,
    },
};

#[cfg(windows)]
const MUTEX_NAME: &str = "Local\\WorkBuddy.Hillmanpick.SingleInstance";
#[cfg(windows)]
const WAKE_EVENT_NAME: &str = "Local\\WorkBuddy.Hillmanpick.ShowExistingWindow";

pub struct SingleInstanceGuard {
    #[cfg(windows)]
    mutex: HANDLE,
    primary: bool,
}

impl SingleInstanceGuard {
    pub fn is_primary(&self) -> bool {
        self.primary
    }
}

#[cfg(windows)]
impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {
        if !self.mutex.is_null() {
            unsafe {
                CloseHandle(self.mutex);
            }
        }
    }
}

#[cfg(not(windows))]
impl Drop for SingleInstanceGuard {
    fn drop(&mut self) {}
}

pub fn acquire() -> SingleInstanceGuard {
    platform_acquire()
}

pub fn notify_existing_instance() {
    platform_notify_existing_instance();
}

pub fn listen_for_second_instance(app: tauri::AppHandle) {
    platform_listen_for_second_instance(app);
}

#[cfg(windows)]
fn platform_acquire() -> SingleInstanceGuard {
    let name = wide(MUTEX_NAME);
    let mutex = unsafe { CreateMutexW(std::ptr::null_mut(), 0, name.as_ptr()) };
    if mutex.is_null() {
        return SingleInstanceGuard {
            mutex: std::ptr::null_mut(),
            primary: true,
        };
    }

    let already_exists = unsafe { GetLastError() } == ERROR_ALREADY_EXISTS;
    if already_exists {
        unsafe {
            CloseHandle(mutex);
        }
        return SingleInstanceGuard {
            mutex: std::ptr::null_mut(),
            primary: false,
        };
    }

    SingleInstanceGuard {
        mutex,
        primary: true,
    }
}

#[cfg(not(windows))]
fn platform_acquire() -> SingleInstanceGuard {
    SingleInstanceGuard { primary: true }
}

#[cfg(windows)]
fn platform_notify_existing_instance() {
    let name = wide(WAKE_EVENT_NAME);
    let event = unsafe { OpenEventW(EVENT_MODIFY_STATE, 0, name.as_ptr()) };
    if event.is_null() {
        return;
    }

    unsafe {
        SetEvent(event);
        CloseHandle(event);
    }
}

#[cfg(not(windows))]
fn platform_notify_existing_instance() {}

#[cfg(windows)]
fn platform_listen_for_second_instance(app: tauri::AppHandle) {
    let name = wide(WAKE_EVENT_NAME);
    let event = unsafe { CreateEventW(std::ptr::null_mut(), 0, 0, name.as_ptr()) };
    if event.is_null() {
        return;
    }

    let event_handle = event as isize;
    std::thread::spawn(move || {
        let event = event_handle as HANDLE;
        loop {
            let result = unsafe { WaitForSingleObject(event, INFINITE) };
            if result != WAIT_OBJECT_0 {
                break;
            }

            if let Some(window) = app.get_window("main") {
                let _ = window.set_skip_taskbar(true);
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = app.emit_all("workbuddy://tray", "showPet");
        }
    });
}

#[cfg(not(windows))]
fn platform_listen_for_second_instance(_app: tauri::AppHandle) {}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}
