import type { ChatAttachment, ChatMessage, ProviderConfig, ProviderId } from "../config/schema";

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

export function attachmentPromptText(attachments: ChatAttachment[] | undefined): string {
  if (!attachments?.length) return "";

  const parts = attachments.map((attachment, index) => {
    const header = `Attachment ${index + 1}: ${attachment.name} (${attachment.mimeType || "unknown"}, ${attachment.size} bytes)`;
    if (attachment.kind === "image") {
      return `${header}\nImage attached for visual analysis.`;
    }
    if (attachment.kind === "text") {
      const truncated = attachment.truncated ? "\n[Content truncated]" : "";
      return `${header}\nContent:\n${attachment.text ?? ""}${truncated}`;
    }
    return `${header}\nBinary file attached. Text extraction is not available in this build.`;
  });

  return `\n\nAttached files:\n${parts.join("\n\n")}`;
}

export function textWithAttachments(message: ChatMessage): string {
  return `${message.content}${attachmentPromptText(message.attachments)}`.trim();
}

export function toProviderMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: textWithAttachments(message),
    }));
}
