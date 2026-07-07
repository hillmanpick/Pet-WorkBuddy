import type { ChatMessage } from "../config/schema";

const CHAT_KEY = "workbuddy.chat.messages";

export function loadChatHistory(): ChatMessage[] {
  const raw = localStorage.getItem(CHAT_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-80)));
}

