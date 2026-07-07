import type { ChatMessage } from "../config/schema";
import type { Translations } from "../i18n";

type MessageListProps = {
  messages: ChatMessage[];
  labels: Translations["chat"];
};

export function MessageList({ messages, labels }: MessageListProps) {
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
          <span className="message-role">{message.role === "user" ? labels.you : "WorkBuddy"}</span>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
  );
}
