import type { ShortcutConfig, WorkBuddyConfig } from "../config/schema";
import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

export type ShortcutAction = keyof ShortcutConfig | `quickCommand:${string}`;

export function normalizeShortcut(value: string): string {
  return value
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === "control") return "Ctrl";
      if (lower === "ctrl") return "Ctrl";
      if (lower === "alt") return "Alt";
      if (lower === "shift") return "Shift";
      if (lower === "meta" || lower === "cmd" || lower === "command") return "Meta";
      if (lower === " ") return "Space";
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join("+");
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");

  const key = event.key === " " ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) parts.push(key);
  return parts.join("+");
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  return normalizeShortcut(shortcutFromKeyboardEvent(event)) === normalizeShortcut(shortcut);
}

export function shortcutEntries(config: WorkBuddyConfig): Array<[ShortcutAction, string]> {
  const quickCommandEntries: Array<[ShortcutAction, string]> = config.quickCommands.map((command) => [
    `quickCommand:${command.id}` as const,
    command.shortcut,
  ]);

  return [
    ["toggleChat", config.shortcuts.toggleChat],
    ["hidePet", config.shortcuts.hidePet],
    ["centerPet", config.shortcuts.centerPet],
    ["quickAsk", config.shortcuts.quickAsk],
    ...quickCommandEntries,
  ];
}

export async function registerConfiguredShortcuts(config: WorkBuddyConfig): Promise<void> {
  if (!isTauriRuntime()) return;

  await Promise.allSettled(
    shortcutEntries(config).map(([name, accelerator]) =>
      invokeCommand("register_shortcut", { name, accelerator: normalizeShortcut(accelerator) }),
    ),
  );
}
