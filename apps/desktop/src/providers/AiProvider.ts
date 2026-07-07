import type { ChatMessage, ProviderConfig, ProviderId } from "../config/schema";

export type AiProviderInput = {
  providerId: ProviderId;
  config: ProviderConfig;
  apiKey: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
};

export type ChatResponse = {
  text: string;
  raw?: unknown;
};

export interface AiProvider {
  id: ProviderId;
  displayName: string;
  chat(input: AiProviderInput): Promise<ChatResponse>;
  streamChat(
    input: AiProviderInput & {
      onDelta: (text: string) => void;
    },
  ): Promise<void>;
}

export function assertApiKey(apiKey: string, providerName: string): void {
  if (!apiKey.trim()) {
    throw new Error(`Missing API key for ${providerName}. Open Settings and add your key first.`);
  }
}

export function toProviderMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

