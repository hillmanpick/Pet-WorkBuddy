import type { ChatMessage } from "../config/schema";

const LEGACY_CHAT_KEY = "workbuddy.chat.messages";
const CONVERSATIONS_KEY = "workbuddy.chat.conversations";
const ACTIVE_CONVERSATION_KEY = "workbuddy.chat.activeConversation";
const CHAT_LIMIT = 500;

export type ChatConversation = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type ChatState = {
  conversations: ChatConversation[];
  activeConversationId: string;
  messages: ChatMessage[];
};

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function titleFromMessages(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const title = firstUserMessage?.content.trim().replace(/\s+/g, " ");
  return title ? title.slice(0, 36) : "";
}

function newConversation(messages: ChatMessage[] = []): ChatConversation {
  const now = Date.now();
  return {
    id: createId(),
    title: titleFromMessages(messages),
    createdAt: messages[0]?.createdAt ?? now,
    updatedAt: messages.at(-1)?.createdAt ?? now,
    messages: messages.slice(-CHAT_LIMIT),
  };
}

function saveConversations(conversations: ChatConversation[]): void {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

function readConversations(): ChatConversation[] {
  const raw = localStorage.getItem(CONVERSATIONS_KEY);
  if (raw) {
    try {
      const stored = JSON.parse(raw) as ChatConversation[];
      if (Array.isArray(stored)) {
        return stored.filter(
          (conversation) =>
            typeof conversation?.id === "string" &&
            Array.isArray(conversation.messages) &&
            typeof conversation.updatedAt === "number",
        );
      }
    } catch {
      return [];
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_CHAT_KEY);
  if (!legacyRaw) return [];

  try {
    const legacyMessages = JSON.parse(legacyRaw) as ChatMessage[];
    if (!Array.isArray(legacyMessages) || !legacyMessages.length) return [];
    const migrated = newConversation(legacyMessages);
    saveConversations([migrated]);
    return [migrated];
  } catch {
    return [];
  }
}

export function loadChatState(): ChatState {
  const conversations = readConversations();
  const storedActiveId = localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  let active = conversations.find((conversation) => conversation.id === storedActiveId);
  if (!active) active = conversations[0];
  if (!active) {
    active = newConversation();
    conversations.push(active);
    saveConversations(conversations);
  }

  localStorage.setItem(ACTIVE_CONVERSATION_KEY, active.id);
  return { conversations, activeConversationId: active.id, messages: active.messages };
}

export function loadChatConversations(): ChatConversation[] {
  return loadChatState().conversations;
}

export function loadChatHistory(conversationId?: string): ChatMessage[] {
  const state = loadChatState();
  return state.conversations.find((conversation) => conversation.id === (conversationId ?? state.activeConversationId))?.messages ?? [];
}

export function createChatConversation(): ChatConversation {
  const conversations = readConversations();
  const conversation = newConversation();
  conversations.push(conversation);
  saveConversations(conversations);
  localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversation.id);
  return conversation;
}

export function setActiveChatConversation(conversationId: string): void {
  if (readConversations().some((conversation) => conversation.id === conversationId)) {
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, conversationId);
  }
}

export function saveChatHistory(messages: ChatMessage[], conversationId?: string): void {
  const conversations = readConversations();
  const activeId = conversationId ?? localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  let index = conversations.findIndex((conversation) => conversation.id === activeId);
  if (index < 0) {
    conversations.push(newConversation());
    index = conversations.length - 1;
  }

  const current = conversations[index];
  const generatedTitle = titleFromMessages(messages);
  conversations[index] = {
    ...current,
    title: current.title || generatedTitle,
    updatedAt: messages.at(-1)?.createdAt ?? current.updatedAt,
    messages: messages.slice(-CHAT_LIMIT),
  };
  saveConversations(conversations);
}
