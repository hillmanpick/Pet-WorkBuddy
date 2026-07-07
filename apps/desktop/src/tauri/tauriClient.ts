type EventUnlisten = () => void;

type TauriWindow = Window & {
  __TAURI__?: unknown;
};

export function isTauriRuntime(): boolean {
  return Boolean((window as TauriWindow).__TAURI__);
}

export async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
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
  if (!isTauriRuntime()) return;
  await invokeCommand("hide_app_window");
}

export async function showAppWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand("show_app_window");
}

export async function centerAppWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand("center_app_window");
}

