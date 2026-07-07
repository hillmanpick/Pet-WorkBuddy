type EventUnlisten = () => void;

type TauriWindow = Window & {
  __TAURI__?: unknown;
  workbuddyDesktop?: {
    platform: "electron";
    hide: () => Promise<void>;
    show: () => Promise<void>;
    center: () => Promise<void>;
    registerShortcut: (name: string, accelerator: string) => Promise<boolean>;
    unregisterShortcut: (accelerator: string) => Promise<void>;
    getApiKey: (provider: string) => Promise<string>;
    setApiKey: (provider: string, apiKey: string) => Promise<void>;
    deleteApiKey: (provider: string) => Promise<void>;
    onShortcut: (handler: (payload: string) => void) => () => void;
    onTray: (handler: (payload: string) => void) => () => void;
  };
};

export function isTauriRuntime(): boolean {
  return Boolean((window as TauriWindow).__TAURI__);
}

export function isElectronRuntime(): boolean {
  return Boolean((window as TauriWindow).workbuddyDesktop);
}

function electronBridge() {
  return (window as TauriWindow).workbuddyDesktop;
}

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const electron = electronBridge();
  if (electron) {
    if (command === "hide_app_window") return electron.hide() as Promise<T>;
    if (command === "show_app_window") return electron.show() as Promise<T>;
    if (command === "center_app_window") return electron.center() as Promise<T>;
    if (command === "register_shortcut") {
      return electron.registerShortcut(String(args?.name ?? ""), String(args?.accelerator ?? "")) as Promise<T>;
    }
    if (command === "unregister_shortcut") {
      return electron.unregisterShortcut(String(args?.accelerator ?? "")) as Promise<T>;
    }
    if (command === "get_api_key") {
      return electron.getApiKey(String(args?.provider ?? "")) as Promise<T>;
    }
    if (command === "set_api_key") {
      return electron.setApiKey(String(args?.provider ?? ""), String(args?.apiKey ?? "")) as Promise<T>;
    }
    if (command === "delete_api_key") {
      return electron.deleteApiKey(String(args?.provider ?? "")) as Promise<T>;
    }
  }

  if (!isTauriRuntime()) {
    throw new Error(`Tauri command '${command}' is unavailable in browser preview.`);
  }

  const { invoke } = await import("@tauri-apps/api/tauri");
  return invoke<T>(command, args);
}

export async function listenTauriEvent<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<EventUnlisten> {
  const electron = electronBridge();
  if (electron && event.includes("shortcut")) {
    return electron.onShortcut((payload) => handler(payload as T));
  }
  if (electron && event.includes("tray")) {
    return electron.onTray((payload) => handler(payload as T));
  }

  if (!isTauriRuntime()) return () => undefined;

  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, ({ payload }) => handler(payload));
}

export async function startWindowDrag(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { appWindow } = await import("@tauri-apps/api/window");
  await appWindow.startDragging();
}

export async function hideAppWindow(): Promise<void> {
  if (!isTauriRuntime() && !isElectronRuntime()) return;
  await invokeCommand("hide_app_window");
}

export async function showAppWindow(): Promise<void> {
  if (!isTauriRuntime() && !isElectronRuntime()) return;
  await invokeCommand("show_app_window");
}

export async function centerAppWindow(): Promise<void> {
  if (!isTauriRuntime() && !isElectronRuntime()) return;
  await invokeCommand("center_app_window");
}
