import type { AiProvider, AiProviderInput, ChatResponse } from "./AiProvider";
import { assertApiKey, textWithAttachments } from "./AiProvider";
import type { ChatMessage, ProviderId } from "../config/schema";

type OpenAIMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type OpenAIChatMessage = {
  role: ChatMessage["role"];
  content: OpenAIMessageContent;
};

export class OpenAIProvider implements AiProvider {
  id: ProviderId = "openai";
  displayName = "ChatGPT";

  async chat(input: AiProviderInput): Promise<ChatResponse> {
    assertApiKey(input.apiKey, input.config.displayName);

    const endpoint = `${input.config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const messages = [
      { role: "system", content: input.config.systemPrompt },
      ...toOpenAIMessages(input.messages),
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

function toOpenAIMessages(messages: ChatMessage[]): OpenAIChatMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const imageAttachments = (message.attachments ?? []).filter(
        (attachment) => attachment.kind === "image" && attachment.dataUrl,
      );
      if (message.role !== "user" || !imageAttachments.length) {
        return {
          role: message.role,
          content: textWithAttachments(message),
        };
      }

      return {
        role: message.role,
        content: [
          { type: "text", text: textWithAttachments(message) || "Please analyze the attached image." },
          ...imageAttachments.map((attachment) => ({
            type: "image_url" as const,
            image_url: { url: attachment.dataUrl ?? "" },
          })),
        ],
      };
    });
}
