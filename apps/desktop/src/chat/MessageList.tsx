import type { ChatMessage } from "../config/schema";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  if (!messages.length) {
    return (
      <div className="empty-chat">
        <strong>WorkBuddy is ready.</strong>
        <span>Ready when you are.</span>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <article className={`message ${message.role}`} key={message.id}>
          <span className="message-role">{message.role === "user" ? "You" : "WorkBuddy"}</span>
          <p>{message.content}</p>
        </article>
      ))}
    </div>
  );
}
