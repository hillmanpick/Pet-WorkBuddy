import type { AiProvider, AiProviderInput, ChatResponse } from "./AiProvider";
import { assertApiKey, textWithAttachments } from "./AiProvider";
import type { ChatAttachment, ChatMessage } from "../config/schema";
import { isSupportedImageMimeType, shouldSendVisionInput } from "./ProviderCapabilities";
import { parseProviderJson, postProviderJson, resolveClaudeEndpoint } from "./ProviderHttp";

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

    const endpoint = resolveClaudeEndpoint(input.config.baseUrl);
    const response = await postProviderJson(
      endpoint,
      {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      {
        model: input.config.modelId,
        system: input.config.systemPrompt,
        messages: toClaudeMessages(input.messages, shouldSendVisionInput(input.providerId, input.config)),
        temperature: input.config.temperature,
        max_tokens: input.config.maxTokens,
      },
      input.signal,
    );

    if (!response.ok) {
      throw new Error(response.text);
    }

    const raw = parseProviderJson<{ content?: Array<{ type?: string; text?: string }> }>(response);
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

function toClaudeMessages(messages: ChatMessage[], supportsVision: boolean): ClaudeMessage[] {
  return messages
    .filter((message): message is ChatMessage & { role: "user" | "assistant" } =>
      message.role === "user" || message.role === "assistant",
    )
    .map((message) => {
      const imageAttachments = supportsVision
        ? (message.attachments ?? []).filter(isSendableClaudeImageAttachment)
        : [];
      const sentImageIds = new Set(imageAttachments.map((attachment) => attachment.id));
      const contentText = textWithAttachments(message, { sentImageIds, visionSupported: supportsVision });
      if (message.role !== "user" || !imageAttachments.length) {
        return {
          role: message.role,
          content: contentText,
        };
      }

      return {
        role: message.role,
        content: [
          { type: "text", text: contentText || "Please analyze the attached image." },
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

function isSendableClaudeImageAttachment(attachment: ChatAttachment): boolean {
  return attachment.kind === "image" && Boolean(attachment.dataUrl) && isSupportedImageMimeType(attachment.mimeType);
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(",", 2)[1] ?? "";
}
