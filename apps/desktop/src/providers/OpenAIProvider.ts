import type { AiProvider, AiProviderInput, ChatResponse } from "./AiProvider";
import { assertApiKey, toProviderMessages } from "./AiProvider";
import type { ProviderId } from "../config/schema";

export class OpenAIProvider implements AiProvider {
  id: ProviderId = "openai";
  displayName = "ChatGPT";

  async chat(input: AiProviderInput): Promise<ChatResponse> {
    assertApiKey(input.apiKey, input.config.displayName);

    const endpoint = `${input.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const messages = [
      { role: "system", content: input.config.systemPrompt },
      ...toProviderMessages(input.messages),
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.config.modelId,
        messages,
        temperature: input.config.temperature,
        max_tokens: input.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const raw = await response.json();
    const text = raw.choices?.[0]?.message?.content ?? "";
    return { text, raw };
  }

  async streamChat(input: AiProviderInput & { onDelta: (text: string) => void }): Promise<void> {
    const result = await this.chat(input);
    input.onDelta(result.text);
  }
}
