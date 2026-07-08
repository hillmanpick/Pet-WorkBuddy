import { useEffect, useMemo, useState } from "react";
import { attachmentSizeLabel } from "../chat/AttachmentProcessor";
import { loadChatHistory } from "../chat/ChatStore";
import type { ChatMessage } from "../config/schema";
import type { Translations } from "../i18n";

type ChatHistorySettingsProps = {
  labels: Translations["history"];
};

type MessageGroup = {
  day: string;
  messages: ChatMessage[];
};

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function dayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function roleLabel(role: ChatMessage["role"], labels: Translations["history"]): string {
  if (role === "user") return labels.user;
  if (role === "assistant") return labels.assistant;
  return labels.system;
}

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const grouped = new Map<string, ChatMessage[]>();
  const sortedMessages = [...messages].sort((a, b) => a.createdAt - b.createdAt);

  sortedMessages.forEach((message) => {
    const key = dayKey(message.createdAt);
    grouped.set(key, [...(grouped.get(key) ?? []), message]);
  });

  return [...grouped.entries()]
    .map(([day, dayMessages]) => ({ day, messages: dayMessages }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export function ChatHistorySettings({ labels }: ChatHistorySettingsProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const groups = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    const refresh = () => setMessages(loadChatHistory());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="settings-stack chat-history-settings">
      <section className="settings-group">
        <h3>{labels.title}</h3>
        {groups.length ? (
          <div className="chat-history-list">
            {groups.map((group) => (
              <section className="chat-history-day" key={group.day}>
                <h4>{group.day}</h4>
                <div className="chat-history-messages">
                  {group.messages.map((message) => (
                    <article className={`chat-history-message ${message.role}`} key={message.id}>
                      <header>
                        <strong>{roleLabel(message.role, labels)}</strong>
                        <time dateTime={new Date(message.createdAt).toISOString()}>{timeKey(message.createdAt)}</time>
                      </header>
                      <p>{message.content}</p>
                      {message.attachments?.length ? (
                        <div className="chat-history-attachments">
                          {message.attachments.map((attachment) => (
                            <span className={`chat-history-attachment ${attachment.kind}`} key={attachment.id}>
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
              </section>
            ))}
          </div>
        ) : (
          <p className="settings-help">{labels.empty}</p>
        )}
      </section>
    </div>
  );
}
