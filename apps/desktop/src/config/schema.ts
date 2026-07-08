export type ProviderId = "openai" | "claude" | "deepseek";
export type UiLanguage = "en" | "zh";

export type ProviderConfig = {
  enabled: boolean;
  displayName: string;
  baseUrl: string;
  apiKeyRef: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
};

export type QuickCommand = {
  id: string;
  name: string;
  shortcut: string;
  prompt: string;
};

export type ShortcutConfig = {
  toggleChat: string;
  hidePet: string;
  centerPet: string;
  quickAsk: string;
};

export type ComputerControlConfig = {
  enabled: boolean;
  requireConfirmation: boolean;
  allowWechatSend: boolean;
};

export type WorkBuddyConfig = {
  activeProvider: ProviderId;
  activePetId: string;
  providers: Record<ProviderId, ProviderConfig>;
  shortcuts: ShortcutConfig;
  quickCommands: QuickCommand[];
  appearance: {
    petSize: number;
    language: UiLanguage;
  };
  behavior: {
    startHidden: boolean;
    launchOnStartup: boolean;
    longIdleMinutes: number;
    mousePassthrough: boolean;
  };
  computerControl: ComputerControlConfig;
};

export type PetAnimationConfig = {
  clip?: string;
  file?: string;
  loop?: boolean;
};

export type PetPack = {
  id: string;
  name: string;
  source?: string;
  sourceUrl?: string;
  license?: string;
  type: "gltf" | "vrm" | "sprite";
  model: string;
  preview?: string;
  scale?: number;
  defaultAnimation: string;
  animations: Record<string, PetAnimationConfig>;
  events?: Record<string, string | { action: string; bubble?: string[] }>;
};

export type PetManifest = {
  defaultPetId: string;
  pets: Array<{
    id: string;
    path: string;
  }>;
};

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};
