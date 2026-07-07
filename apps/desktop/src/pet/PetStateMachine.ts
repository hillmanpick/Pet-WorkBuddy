import type { PetPack } from "../config/schema";

export type PetAction =
  | "idle"
  | "walk"
  | "run"
  | "eat"
  | "happy"
  | "positive"
  | "negative"
  | "thinking"
  | "talking"
  | "dragged"
  | "alert"
  | "rest";

export type PetEvent =
  | "onClick"
  | "onChatOpen"
  | "onUserSendMessage"
  | "onAiReplyStart"
  | "onAiReplyEnd"
  | "onLongIdle"
  | "onDragStart"
  | "onDragEnd"
  | "onError";

export type ResolvedPetAction = {
  action: string;
  bubble?: string;
};

const fallbackEvents: Record<PetEvent, string> = {
  onClick: "happy",
  onChatOpen: "positive",
  onUserSendMessage: "thinking",
  onAiReplyStart: "talking",
  onAiReplyEnd: "happy",
  onLongIdle: "rest",
  onDragStart: "dragged",
  onDragEnd: "idle",
  onError: "negative",
};

export function resolvePetEvent(pack: PetPack | null, event: PetEvent): ResolvedPetAction {
  const configured = pack?.events?.[event];
  if (typeof configured === "string") {
    return { action: configured };
  }

  if (configured && typeof configured === "object") {
    const bubble = configured.bubble?.length
      ? configured.bubble[Math.floor(Math.random() * configured.bubble.length)]
      : undefined;
    return { action: configured.action, bubble };
  }

  return { action: fallbackEvents[event] ?? "idle" };
}

export function normalizeAction(pack: PetPack | null, action: string): string {
  if (!pack) return "idle";
  if (pack.animations[action]) return action;
  if (action === "thinking" && pack.animations.idle) return "idle";
  if (action === "talking" && pack.animations.positive) return "positive";
  if (action === "dragged" && pack.animations.negative) return "negative";
  if (action === "alert" && pack.animations.positive) return "positive";
  if (action === "rest" && pack.animations.static) return "static";
  return pack.defaultAnimation;
}

