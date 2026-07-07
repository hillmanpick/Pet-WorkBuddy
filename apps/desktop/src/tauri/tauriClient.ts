type EventUnlisten = () => void;
type ScreenEdge = "left" | "right" | "top" | "bottom";

export type DesktopWindowMode = "pet" | "chat";

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

function windowSizeForMode(mode: DesktopWindowMode, petSize: number) {
  if (mode === "chat") {
    return { width: Math.max(360, petSize + 150), height: Math.max(390, petSize + 190) };
  }
  return { width: Math.max(320, petSize + 120), height: Math.max(330, petSize + 138) };
}

function visibleStripForPet(petSize: number) {
  return Math.round(60 + petSize / 3);
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

export async function setDesktopWindowMode(
  mode: DesktopWindowMode,
  petSize: number,
): Promise<void> {
  if (!isTauriRuntime()) return;

  const { width, height } = windowSizeForMode(mode, petSize);
  const { appWindow, LogicalSize } = await import("@tauri-apps/api/window");
  await appWindow.setSize(new LogicalSize(width, height));
}

export async function openSettingsWindow(): Promise<void> {
  if (!isTauriRuntime()) return;

  const { WebviewWindow, getAll } = await import("@tauri-apps/api/window");
  const existing = getAll().find((item) => item.label === "settings");
  if (existing) {
    await existing.show();
    await existing.setFocus();
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("view", "settings");

  new WebviewWindow("settings", {
    url: url.href,
    title: "WorkBuddy Settings",
    width: 760,
    height: 680,
    minWidth: 640,
    minHeight: 520,
    center: true,
    decorations: true,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    transparent: false,
  });
}

export async function closeCurrentWindow(): Promise<void> {
  if (!isTauriRuntime()) return;

  const { appWindow } = await import("@tauri-apps/api/window");
  await appWindow.close();
}

function nearestEdge(
  position: { x: number; y: number },
  size: { width: number; height: number },
  area: { x: number; y: number; width: number; height: number },
): { edge: ScreenEdge; value: number } {
  return [
    { edge: "left" as const, value: Math.abs(position.x - area.x) },
    { edge: "right" as const, value: Math.abs(area.x + area.width - (position.x + size.width)) },
    { edge: "top" as const, value: Math.abs(position.y - area.y) },
    { edge: "bottom" as const, value: Math.abs(area.y + area.height - (position.y + size.height)) },
  ].sort((a, b) => a.value - b.value)[0];
}

export async function snapWindowToScreenEdge(visible = 124): Promise<void> {
  if (!isTauriRuntime()) return;

  const { appWindow, currentMonitor, PhysicalPosition } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor();
  if (!monitor) return;

  const position = await appWindow.outerPosition();
  const size = await appWindow.outerSize();
  const area = {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  };

  const tucked = nearestEdge(position, size, area);
  if (tucked.value > 28) return;

  let x = position.x;
  let y = position.y;
  if (tucked.edge === "left") x = area.x - size.width + visible;
  if (tucked.edge === "right") x = area.x + area.width - visible;
  if (tucked.edge === "top") y = area.y - size.height + visible;
  if (tucked.edge === "bottom") y = area.y + area.height - visible;

  await appWindow.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
}

export async function peekWindowFromScreenEdge(): Promise<void> {
  if (!isTauriRuntime()) return;

  const { appWindow, currentMonitor, PhysicalPosition } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor();
  if (!monitor) return;

  const position = await appWindow.outerPosition();
  const size = await appWindow.outerSize();
  const area = {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  };

  let x = position.x;
  let y = position.y;
  if (position.x < area.x) x = area.x;
  if (position.x + size.width > area.x + area.width) x = area.x + area.width - size.width;
  if (position.y < area.y) y = area.y;
  if (position.y + size.height > area.y + area.height) y = area.y + area.height - size.height;

  if (x !== position.x || y !== position.y) {
    await appWindow.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  }
}

export async function armWindowEdgeSnap(petSize = 190): Promise<EventUnlisten> {
  if (!isTauriRuntime()) return () => undefined;

  const { appWindow } = await import("@tauri-apps/api/window");
  const visible = visibleStripForPet(petSize);
  let timer = 0;
  let cleanupTimer = 0;
  let unlisten: EventUnlisten = () => undefined;

  function cleanup() {
    window.clearTimeout(timer);
    window.clearTimeout(cleanupTimer);
    unlisten();
  }

  unlisten = await appWindow.onMoved(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      cleanup();
      void snapWindowToScreenEdge(visible);
    }, 240);
  });

  cleanupTimer = window.setTimeout(cleanup, 8000);
  return cleanup;
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
