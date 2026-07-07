export type WorkBuddyProviderId = "openai" | "claude" | "deepseek";

export type WorkBuddyProviderSettings = {
  displayName: string;
  baseUrl: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
};

