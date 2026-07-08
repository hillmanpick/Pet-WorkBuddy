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

export function visibleStripForPet(petSize: number) {
  return Math.round(Math.max(72, petSize * 0.48));
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

function petVisualBounds(
  windowSize: { width: number; height: number },
  petSize: number,
  scaleFactor: number,
) {
  const pet = petSize * scaleFactor;
  const petShell = (petSize + 92) * scaleFactor;
  const sideInset = Math.max(0, (windowSize.width - petShell) / 2) + 46 * scaleFactor;
  const topInset = 46 * scaleFactor;

  return {
    left: sideInset,
    right: sideInset + pet,
    top: topInset,
    bottom: topInset + pet,
    size: pet,
  };
}

function nearestPetEdge(
  position: { x: number; y: number },
  bounds: { left: number; right: number; top: number; bottom: number },
  area: { x: number; y: number; width: number; height: number },
): { edge: ScreenEdge; value: number } {
  return [
    { edge: "left" as const, value: Math.abs(position.x + bounds.left - area.x) },
    { edge: "right" as const, value: Math.abs(area.x + area.width - (position.x + bounds.right)) },
    { edge: "top" as const, value: Math.abs(position.y + bounds.top - area.y) },
    { edge: "bottom" as const, value: Math.abs(area.y + area.height - (position.y + bounds.bottom)) },
  ].sort((a, b) => a.value - b.value)[0];
}

export async function snapWindowToScreenEdge(
  visible = 92,
  petSize = 190,
): Promise<ScreenEdge | null> {
  if (!isTauriRuntime()) return null;

  const { appWindow, currentMonitor, PhysicalPosition } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor();
  if (!monitor) return null;

  const position = await appWindow.outerPosition();
  const size = await appWindow.outerSize();
  const scaleFactor = monitor.scaleFactor || 1;
  const bounds = petVisualBounds(size, petSize, scaleFactor);
  const area = {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  };

  const tucked = nearestPetEdge(position, bounds, area);
  const snapTolerance = Math.max(42, petSize * 0.38 * scaleFactor);
  if (tucked.value > snapTolerance) return null;
  const visibleSize = visible * scaleFactor;

  let x = position.x;
  let y = position.y;
  if (tucked.edge === "left") x = area.x - bounds.left - bounds.size + visibleSize;
  if (tucked.edge === "right") x = area.x + area.width + bounds.size - visibleSize - bounds.right;
  if (tucked.edge === "top") y = area.y - bounds.top - bounds.size + visibleSize;
  if (tucked.edge === "bottom") y = area.y + area.height + bounds.size - visibleSize - bounds.bottom;

  await appWindow.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  return tucked.edge;
}

export async function peekWindowFromScreenEdge(petSize = 190): Promise<void> {
  if (!isTauriRuntime()) return;

  const { appWindow, currentMonitor, PhysicalPosition } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor();
  if (!monitor) return;

  const position = await appWindow.outerPosition();
  const size = await appWindow.outerSize();
  const scaleFactor = monitor.scaleFactor || 1;
  const bounds = petVisualBounds(size, petSize, scaleFactor);
  const margin = 4 * scaleFactor;
  const area = {
    x: monitor.position.x,
    y: monitor.position.y,
    width: monitor.size.width,
    height: monitor.size.height,
  };

  let x = position.x;
  let y = position.y;
  if (position.x + bounds.left < area.x) x = area.x - bounds.left + margin;
  if (position.x + bounds.right > area.x + area.width) x = area.x + area.width - bounds.right - margin;
  if (position.y + bounds.top < area.y) y = area.y - bounds.top + margin;
  if (position.y + bounds.bottom > area.y + area.height) y = area.y + area.height - bounds.bottom - margin;

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
      void snapWindowToScreenEdge(visible, petSize);
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

export async function walkAppWindowRandomly(
  durationMs = 4200,
  onMoveStart?: (movement: { dx: number; dy: number }) => void,
): Promise<{ dx: number; dy: number } | null> {
  if (!isTauriRuntime()) return null;

  const { appWindow, currentMonitor, PhysicalPosition } = await import("@tauri-apps/api/window");
  const monitor = await currentMonitor();
  if (!monitor) return null;

  const start = await appWindow.outerPosition();
  const size = await appWindow.outerSize();
  const margin = 24;
  const minX = monitor.position.x + margin;
  const maxX = monitor.position.x + monitor.size.width - size.width - margin;
  const minY = monitor.position.y + margin;
  const maxY = monitor.position.y + monitor.size.height - size.height - margin;
  if (maxX <= minX || maxY <= minY) return null;

  const target = {
    x: Math.round(minX + Math.random() * (maxX - minX)),
    y: Math.round(minY + Math.random() * (maxY - minY)),
  };
  const movement = {
    dx: target.x - start.x,
    dy: target.y - start.y,
  };
  const startedAt = performance.now();

  await appWindow.show();
  onMoveStart?.(movement);

  await new Promise<void>((resolve) => {
    const tick = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const x = Math.round(start.x + (target.x - start.x) * eased);
      const y = Math.round(start.y + (target.y - start.y) * eased);
      void appWindow.setPosition(new PhysicalPosition(x, y));

      if (progress < 1) {
        window.setTimeout(tick, 30);
      } else {
        resolve();
      }
    };

    tick();
  });

  return movement;
}

export async function getLaunchOnStartup(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invokeCommand<boolean>("get_launch_on_startup");
}

export async function setLaunchOnStartup(enabled: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  await invokeCommand("set_launch_on_startup", { enabled });
}
