import type { AiProvider, AiProviderInput, ChatResponse } from "./AiProvider";
import { assertApiKey, toProviderMessages } from "./AiProvider";

export class ClaudeProvider implements AiProvider {
  id = "claude" as const;
  displayName = "Claude";

  async chat(input: AiProviderInput): Promise<ChatResponse> {
    assertApiKey(input.apiKey, input.config.displayName);

    const endpoint = `${input.config.baseUrl.replace(/\/$/, "")}/v1/messages`;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: input.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.config.modelId,
        system: input.config.systemPrompt,
        messages: toProviderMessages(input.messages).filter((message) => message.role !== "system"),
        temperature: input.config.temperature,
        max_tokens: input.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const raw = await response.json();
    const text = Array.isArray(raw.content)
      ? raw.content
          .filter((part: { type?: string }) => part.type === "text")
          .map((part: { text?: string }) => part.text ?? "")
          .join("")
      : "";

    return { text, raw };
  }

  async streamChat(input: AiProviderInput & { onDelta: (text: string) => void }): Promise<void> {
    const result = await this.chat(input);
    input.onDelta(result.text);
  }
}

