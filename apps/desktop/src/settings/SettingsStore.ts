import { defaultConfig, mergeConfig } from "../config/defaultConfig";
import type { WorkBuddyConfig } from "../config/schema";
import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

const CONFIG_KEY = "workbuddy.config";
const SECRET_PREFIX = "workbuddy.secret.";

export async function loadConfig(): Promise<WorkBuddyConfig> {
  const raw = localStorage.getItem(CONFIG_KEY);
  if (!raw) return defaultConfig;

  try {
    return mergeConfig(JSON.parse(raw) as Partial<WorkBuddyConfig>);
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

