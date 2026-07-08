import type { AiProvider, AiProviderInput, ChatResponse } from "./AiProvider";
import { assertApiKey, textWithAttachments } from "./AiProvider";
import type { ChatMessage } from "../config/schema";

type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
};

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
        messages: toClaudeMessages(input.messages),
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

function toClaudeMessages(messages: ChatMessage[]): ClaudeMessage[] {
  return messages
    .filter((message): message is ChatMessage & { role: "user" | "assistant" } =>
      message.role === "user" || message.role === "assistant",
    )
    .map((message) => {
      const imageAttachments = (message.attachments ?? []).filter(
        (attachment) => attachment.kind === "image" && attachment.dataUrl && isClaudeImageType(attachment.mimeType),
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
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: attachment.mimeType,
              data: dataUrlToBase64(attachment.dataUrl ?? ""),
            },
          })),
        ],
      };
    });
}

function isClaudeImageType(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(",", 2)[1] ?? "";
}
