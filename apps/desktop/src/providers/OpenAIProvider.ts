import type { AiProvider, AiProviderInput, ChatResponse } from "./AiProvider";
import { assertApiKey, textWithAttachments } from "./AiProvider";
import type { ChatAttachment, ChatMessage, ProviderId } from "../config/schema";
import { isSupportedImageMimeType, shouldSendVisionInput } from "./ProviderCapabilities";

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
    const supportsVision = this.supportsVision(input);
    const buildMessages = (includeVision: boolean): OpenAIChatMessage[] => [
      { role: "system", content: input.config.systemPrompt },
      ...toOpenAIMessages(input.messages, includeVision),
    ];

    const postChat = (messages: OpenAIChatMessage[]) =>
      fetch(endpoint, {
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

    let response = await postChat(buildMessages(supportsVision));

    if (!response.ok) {
      const errorText = await response.text();
      if (supportsVision && hasImageAttachments(input.messages) && isVisionPayloadError(errorText)) {
        response = await postChat(buildMessages(false));
      } else {
        throw new Error(errorText);
      }
    }

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

  protected supportsVision(input: AiProviderInput): boolean {
    return shouldSendVisionInput(input.providerId, input.config);
  }
}

function toOpenAIMessages(messages: ChatMessage[], supportsVision: boolean): OpenAIChatMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const imageAttachments = supportsVision
        ? (message.attachments ?? []).filter(isSendableImageAttachment)
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
            type: "image_url" as const,
            image_url: { url: attachment.dataUrl ?? "" },
          })),
        ],
      };
    });
}

function isSendableImageAttachment(attachment: ChatAttachment): boolean {
  return attachment.kind === "image" && Boolean(attachment.dataUrl) && isSupportedImageMimeType(attachment.mimeType);
}

function hasImageAttachments(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.attachments?.some((attachment) => attachment.kind === "image"));
}

function isVisionPayloadError(errorText: string): boolean {
  return /image_url|image input|vision|multimodal|expected text|content.*array/i.test(errorText);
}
