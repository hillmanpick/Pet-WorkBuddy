import type { WorkBuddyConfig } from "./schema";

export const defaultConfig: WorkBuddyConfig = {
  activeProvider: "openai",
  activePetId: "kenney-cat",
  providers: {
    openai: {
      enabled: true,
      displayName: "ChatGPT",
      baseUrl: "https://api.openai.com/v1",
      apiKeyRef: "workbuddy.openai.api_key",
      modelId: "gpt-5.5",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt:
        "You are WorkBuddy, a warm, concise AI desktop companion. Help the user think clearly and get work done.",
    },
    claude: {
      enabled: true,
      displayName: "Claude",
      baseUrl: "https://api.anthropic.com",
      apiKeyRef: "workbuddy.claude.api_key",
      modelId: "claude-4.7",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt:
        "You are WorkBuddy, a warm, concise AI desktop companion. Help the user think clearly and get work done.",
    },
    deepseek: {
      enabled: true,
      displayName: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyRef: "workbuddy.deepseek.api_key",
      modelId: "deepseek-v4-pro",
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt:
        "You are WorkBuddy, a warm, concise AI desktop companion. Help the user think clearly and get work done.",
    },
  },
  shortcuts: {
    toggleChat: "Ctrl+Alt+W",
    hidePet: "Ctrl+Alt+H",
    centerPet: "Ctrl+Alt+B",
    quickAsk: "Ctrl+Alt+Space",
  },
  quickCommands: [
    {
      id: "daily-plan",
      name: "Daily Plan",
      shortcut: "Ctrl+Alt+1",
      prompt: "Help me organize today's work plan by priority.",
    },
    {
      id: "explain",
      name: "Explain",
      shortcut: "Ctrl+Alt+2",
      prompt: "Explain the next thing I paste in simple, practical language.",
    },
    {
      id: "focus",
      name: "Focus",
      shortcut: "Ctrl+Alt+3",
      prompt: "Turn my current task into a 25-minute focus plan.",
    },
  ],
  appearance: {
    petSize: 190,
    language: "zh",
    petName: "",
    chatColor: "mint",
  },
  behavior: {
    startHidden: false,
    launchOnStartup: false,
    longIdleMinutes: 5,
    doNotDisturb: false,
    mousePassthrough: true,
  },
  agent: {
    enabled: true,
    maxIterations: 3,
    mcpServers: {},
  },
  computerControl: {
    enabled: true,
    authorizationMode: "confirmSensitive",
    requireConfirmation: true,
    allowWechatSend: true,
  },
};

export function mergeConfig(value: Partial<WorkBuddyConfig> | null): WorkBuddyConfig {
  if (!value) return defaultConfig;

  return {
    ...defaultConfig,
    ...value,
    providers: {
      ...defaultConfig.providers,
      ...value.providers,
      openai: { ...defaultConfig.providers.openai, ...value.providers?.openai },
      claude: { ...defaultConfig.providers.claude, ...value.providers?.claude },
      deepseek: { ...defaultConfig.providers.deepseek, ...value.providers?.deepseek },
    },
    shortcuts: {
      ...defaultConfig.shortcuts,
      ...value.shortcuts,
    },
    appearance: {
      ...defaultConfig.appearance,
      ...value.appearance,
    },
    behavior: {
      ...defaultConfig.behavior,
      ...value.behavior,
      doNotDisturb: value.behavior?.doNotDisturb ?? defaultConfig.behavior.doNotDisturb,
      mousePassthrough: value.behavior?.mousePassthrough ?? defaultConfig.behavior.mousePassthrough,
    },
    agent: {
      ...defaultConfig.agent,
      ...value.agent,
      mcpServers: {
        ...defaultConfig.agent.mcpServers,
        ...value.agent?.mcpServers,
      },
    },
    computerControl: {
      ...defaultConfig.computerControl,
      ...value.computerControl,
    },
    quickCommands: value.quickCommands ?? defaultConfig.quickCommands,
  };
}
