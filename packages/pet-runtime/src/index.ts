export type PetActionName =
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

export type PetEventName =
  | "onClick"
  | "onChatOpen"
  | "onUserSendMessage"
  | "onAiReplyStart"
  | "onAiReplyEnd"
  | "onLongIdle"
  | "onDragStart"
  | "onDragEnd"
  | "onError";

