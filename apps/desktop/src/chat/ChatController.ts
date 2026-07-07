import type { ChatMessage, WorkBuddyConfig } from "../config/schema";
import { getProvider } from "../providers/ProviderRegistry";
import { getApiKey } from "../settings/SettingsStore";

export function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
  };
}

export async function requestAssistantReply(
  config: WorkBuddyConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const providerConfig = config.providers[config.activeProvider];
  const provider = getProvider(config.activeProvider);
  const apiKey = await getApiKey(config.activeProvider);
  const result = await provider.chat({
    providerId: config.activeProvider,
    config: providerConfig,
    apiKey,
    messages,
    signal,
  });
  return result.text.trim();
}

