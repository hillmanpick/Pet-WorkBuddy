import type { ProviderId } from "../config/schema";
import type { AiProvider } from "./AiProvider";
import { ClaudeProvider } from "./ClaudeProvider";
import { DeepSeekProvider } from "./DeepSeekProvider";
import { OpenAIProvider } from "./OpenAIProvider";

const providers: Record<ProviderId, AiProvider> = {
  openai: new OpenAIProvider(),
  claude: new ClaudeProvider(),
  deepseek: new DeepSeekProvider(),
};

export function getProvider(providerId: ProviderId): AiProvider {
  return providers[providerId];
}

export function listProviders(): AiProvider[] {
  return Object.values(providers);
}

