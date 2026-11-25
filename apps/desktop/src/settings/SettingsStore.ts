import { defaultConfig, mergeConfig } from "../config/defaultConfig";
import type { WorkBuddyConfig } from "../config/schema";
import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

const CONFIG_KEY = "workbuddy.config";
const SECRET_PREFIX = "workbuddy.secret.";
const CHAT_THEME_MIGRATION_KEY = "workbuddy.chat.theme.graphite.v1";

export async function loadConfig(): Promise<WorkBuddyConfig> {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return defaultConfig;

  try {
    const stored = JSON.parse(raw) as Partial<WorkBuddyConfig>;
    const config = mergeConfig(stored);
    if (stored.appearance?.chatColor === "mint" && localStorage.getItem(CHAT_THEME_MIGRATION_KEY) !== "done") {
      config.appearance.chatColor = "graphite";
      await saveConfig(config);
      localStorage.setItem(CHAT_THEME_MIGRATION_KEY, "done");
    }
    return config;
  } catch {
    return defaultConfig;
  }
}

export async function saveConfig(config: WorkBuddyConfig): Promise<void> {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config, null, 2));
}

export async function getApiKey(provider: string): Promise<string> {
  if (isTauriRuntime()) {
    const value = await invokeCommand<string | null>("get_api_key", { provider });
    return value ?? "";
  }

  return localStorage.getItem(`${SECRET_PREFIX}${provider}`) ?? "";
}

export async function setApiKey(provider: string, apiKey: string): Promise<void> {
  if (isTauriRuntime()) {
    await invokeCommand("set_api_key", { provider, apiKey });
    return;
  }

  localStorage.setItem(`${SECRET_PREFIX}${provider}`, apiKey);
}

export async function deleteApiKey(provider: string): Promise<void> {
  if (isTauriRuntime()) {
    await invokeCommand("delete_api_key", { provider });
    return;
  }

  localStorage.removeItem(`${SECRET_PREFIX}${provider}`);
}
