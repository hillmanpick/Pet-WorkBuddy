import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { ChatMessage } from "../config/schema";
import type { Translations } from "../i18n";
import { attachmentSizeLabel } from "./AttachmentProcessor";
import { MarkdownText } from "./MarkdownDisplay";

type MessageListProps = {
  messages: ChatMessage[];
  labels: Translations["chat"];
  onCopyAssistant?: (message: ChatMessage) => void | Promise<void>;
  copyTitle?: string;
  copiedTitle?: string;
};

export function MessageList({ messages, labels, onCopyAssistant, copyTitle, copiedTitle }: MessageListProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  if (!messages.length) {
    return (
      <div className="empty-chat">
        <strong>{labels.readyTitle}</strong>
        <span>{labels.readySubtitle}</span>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <article className={`message ${message.role}`} key={message.id}>
          <div className="message-meta">
            <span className="message-role">{message.role === "user" ? labels.you : labels.assistant}</span>
            {message.role === "assistant" && onCopyAssistant ? (
              <button
                className="message-copy-action"
                type="button"
                aria-label={copiedMessageId === message.id ? copiedTitle : copyTitle}
                title={copiedMessageId === message.id ? copiedTitle : copyTitle}
                onClick={() => {
                  void Promise.resolve(onCopyAssistant(message))
                    .then(() => {
                      setCopiedMessageId(message.id);
                      window.setTimeout(() => {
                        setCopiedMessageId((current) => current === message.id ? null : current);
                      }, 1500);
                    })
                    .catch(() => setCopiedMessageId(null));
                }}
              >
                {copiedMessageId === message.id ? <Check size={14} /> : <Copy size={14} />}
              </button>
            ) : null}
          </div>
          <MarkdownText content={message.content} />
          {message.attachments?.length ? (
            <div className="message-attachments">
              {message.attachments.map((attachment) => (
                <span className={`message-attachment ${attachment.kind}`} key={attachment.id}>
                  {attachment.kind === "image" && attachment.dataUrl ? <img src={attachment.dataUrl} alt="" /> : null}
                  <span>{attachment.name}</span>
                  <small>{attachmentSizeLabel(attachment.size)}</small>
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
