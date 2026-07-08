import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { ChatMessage, ProviderId, QuickCommand, WorkBuddyConfig } from "../config/schema";
import { defaultConfig, mergeConfig } from "../config/defaultConfig";
import { ChatWindow } from "../components/ChatWindow";
import { PetWindow } from "../components/PetWindow";
import { SettingsWindow } from "../components/SettingsWindow";
import type { ComputerTaskPhase } from "../components/ComputerTaskPanel";
import {
  createComputerTaskPlan,
  executeComputerActions,
  type ComputerTaskPlan,
} from "../computer/ComputerTask";
import { translations } from "../i18n";
import { createMessage, requestAssistantReply } from "../chat/ChatController";
import { loadChatHistory, saveChatHistory } from "../chat/ChatStore";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { loadPetManifest, loadPetPack, loadPetPackById } from "../pet/PetPackLoader";
import { nextPetAction, randomIdleAction } from "../pet/PetRuntime";
import type { PetEvent } from "../pet/PetStateMachine";
import {
  centerAppWindow,
  closeCurrentWindow,
  getLaunchOnStartup,
  hideAppWindow,
  isTauriRuntime,
  listenTauriEvent,
  openSettingsWindow,
  peekWindowFromScreenEdge,
  setDesktopWindowMode,
  showAppWindow,
} from "../tauri/tauriClient";
import {
  matchesShortcut,
  registerConfiguredShortcuts,
  shortcutEntries,
  type ShortcutAction,
} from "../shortcuts/ShortcutManager";
import {
  deleteApiKey,
  getApiKey,
  loadConfig,
  saveConfig,
  setApiKey,
} from "../settings/SettingsStore";

type Panel = "none" | "chat" | "settings";
const CONFIG_CHANNEL = "workbuddy.config";

function publishConfig(config: WorkBuddyConfig) {
  if (!("BroadcastChannel" in window)) return;
  const channel = new BroadcastChannel(CONFIG_CHANNEL);
  channel.postMessage(config);
  channel.close();
}

async function loadConfigWithStartupState(): Promise<WorkBuddyConfig> {
  const nextConfig = await loadConfig();
  if (!isTauriRuntime()) return nextConfig;

  try {
    const launchOnStartup = await getLaunchOnStartup();
    return {
      ...nextConfig,
      behavior: {
        ...nextConfig.behavior,
        launchOnStartup,
      },
    };
  } catch {
    return nextConfig;
  }
}

export function App() {
  if (new URLSearchParams(window.location.search).get("view") === "settings") {
    return <SettingsApp />;
  }

  return <PetApp />;
}

function PetApp() {
  const [config, setConfig] = useState<WorkBuddyConfig>(defaultConfig);
  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [petPack, setPetPack] = useState<LoadedPetPack | null>(null);
  const [petCatalog, setPetCatalog] = useState<LoadedPetPack[]>([]);
  const [petAction, setPetAction] = useState("idle");
  const [bubble, setBubble] = useState<string | undefined>(
    translations[defaultConfig.appearance.language].pet.greeting,
  );
  const [panel, setPanel] = useState<Panel>("none");
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [computerTask, setComputerTask] = useState<{
    plan: ComputerTaskPlan;
    phase: ComputerTaskPhase;
  } | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [status, setStatus] = useState("Ready");
  const loadedRef = useRef(false);
  const reminderTimersRef = useRef<number[]>([]);
  const labels = translations[config.appearance.language];

  const updateConfig = useCallback((next: WorkBuddyConfig) => {
    setConfig(next);
    void saveConfig(next);
    publishConfig(next);
  }, []);

  const triggerPet = useCallback(
    (event: PetEvent, overrideBubble?: string, duration = 3500) => {
      const next = nextPetAction(petPack, event);
      setPetAction(next.action);
      setBubble(overrideBubble ?? next.bubble);
      window.setTimeout(() => setBubble(undefined), duration);
    },
    [petPack],
  );

  const playPetClickAction = useCallback(() => {
    const candidates = ["happy", "positive", "eat", "run", "walk", "idle"].filter(
      (action) => petPack?.animations[action],
    );
    const action = candidates[Math.floor(Math.random() * candidates.length)] ?? petPack?.defaultAnimation ?? "idle";
    setPetAction(action);
    setBubble(labels.pet.clicked);
    window.setTimeout(() => setBubble(undefined), 1800);
    window.setTimeout(() => setPetAction(randomIdleAction(petPack)), 2200);
  }, [labels.pet.clicked, petPack]);

  const openChat = useCallback(() => {
    setPanel("chat");
    setFocusToken((value) => value + 1);
    triggerPet("onChatOpen", labels.pet.listening);
  }, [labels.pet.listening, triggerPet]);

  const toggleChat = useCallback(() => {
    if (panel === "chat") {
      setPanel("none");
      return;
    }
    openChat();
  }, [openChat, panel]);

  const openSettings = useCallback(() => {
    if (isTauriRuntime()) {
      void openSettingsWindow();
    } else {
      setPanel("settings");
    }
  }, []);

  const hidePet = useCallback(() => {
    if (isTauriRuntime()) {
      void hideAppWindow();
    } else {
      setPanel("none");
      setBubble(labels.pet.browserCannotHide);
    }
  }, [labels.pet.browserCannotHide]);

  const runComputerTask = useCallback(
    async (plan: ComputerTaskPlan, phase: ComputerTaskPhase) => {
      if (busy) return;

      if (phase === "prepare" && plan.localTask?.type === "reminder") {
        setBusy(true);
        const { message, delayMs } = plan.localTask;
        const timer = window.setTimeout(() => {
          void showAppWindow();
          triggerPet("onAiReplyEnd", `${labels.computer.reminderDue}: ${message}`, 12000);
        }, delayMs);
        reminderTimersRef.current.push(timer);
        setComputerTask(null);
        setStatus("Ready");
        triggerPet("onAiReplyEnd", labels.computer.reminderSet, 5200);
        setBusy(false);
        return;
      }

      const actions = phase === "final" ? plan.finalActions ?? [] : plan.actions;
      if (!actions.length) {
        setComputerTask(null);
        return;
      }

      setBusy(true);
      setStatus("Running task");
      triggerPet("onUserSendMessage", labels.computer.running);

      try {
        await executeComputerActions(actions);

        if (phase === "prepare" && plan.finalActions?.length) {
          if (config.computerControl.allowWechatSend) {
            setComputerTask({ plan, phase: "final" });
            setStatus("Waiting for final confirmation");
            triggerPet("onAiReplyEnd", labels.computer.readyToSend, 9000);
          } else {
            setComputerTask(null);
            setStatus("Ready");
            triggerPet("onAiReplyEnd", labels.computer.manualSend, 9000);
          }
          return;
        }

        setComputerTask(null);
        setStatus("Ready");
        triggerPet("onAiReplyEnd", labels.computer.done, 5200);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus("Task error");
        triggerPet("onError", message, 8000);
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      config.computerControl.allowWechatSend,
      labels.computer.done,
      labels.computer.manualSend,
      labels.computer.readyToSend,
      labels.computer.reminderDue,
      labels.computer.reminderSet,
      labels.computer.running,
      triggerPet,
    ],
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (busy) return;

      const userMessage = createMessage("user", text);
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      saveChatHistory(nextMessages);

      const taskPlan = createComputerTaskPlan(text, config.appearance.language);
      if (taskPlan) {
        if (!config.computerControl.enabled) {
          const assistantMessage = createMessage("assistant", labels.computer.disabled);
          const finalMessages = [...nextMessages, assistantMessage];
          setMessages(finalMessages);
          saveChatHistory(finalMessages);
          triggerPet("onError", labels.computer.disabled, 5200);
          return;
        }

        const assistantMessage = createMessage("assistant", `${labels.computer.detected}: ${taskPlan.summary}`);
        const finalMessages = [...nextMessages, assistantMessage];
        setMessages(finalMessages);
        saveChatHistory(finalMessages);
        setPanel("chat");
        setFocusToken((value) => value + 1);
        setComputerTask({ plan: taskPlan, phase: "prepare" });
        triggerPet("onChatOpen", labels.computer.needConfirm, 7000);

        if (!config.computerControl.requireConfirmation) {
          void runComputerTask(taskPlan, "prepare");
        }
        return;
      }

      setBusy(true);
      setStatus("Thinking");
      triggerPet("onUserSendMessage", labels.pet.thinking);

      try {
        const reply = await requestAssistantReply(config, nextMessages);
        const assistantMessage = createMessage("assistant", reply || "(empty reply)");
        const finalMessages = [...nextMessages, assistantMessage];
        setMessages(finalMessages);
        saveChatHistory(finalMessages);
        triggerPet("onAiReplyEnd", reply || labels.pet.done, Math.min(14000, Math.max(5200, reply.length * 90)));
        setStatus("Ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const assistantMessage = createMessage("assistant", `Error: ${message}`);
        const finalMessages = [...nextMessages, assistantMessage];
        setMessages(finalMessages);
        saveChatHistory(finalMessages);
        triggerPet("onError", message || labels.pet.apiKeyNeeded, 7000);
        setStatus("Provider error");
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      config,
      labels.computer.detected,
      labels.computer.disabled,
      labels.computer.needConfirm,
      labels.pet.apiKeyNeeded,
      labels.pet.done,
      labels.pet.thinking,
      messages,
      runComputerTask,
      triggerPet,
    ],
  );

  const confirmComputerTask = useCallback(() => {
    if (!computerTask) return;
    void runComputerTask(computerTask.plan, computerTask.phase);
  }, [computerTask, runComputerTask]);

  const cancelComputerTask = useCallback(() => {
    setComputerTask(null);
    setStatus("Ready");
    triggerPet("onClick", labels.computer.cancelled, 3200);
  }, [labels.computer.cancelled, triggerPet]);

  const runQuickCommand = useCallback(
    (command: QuickCommand) => {
      if (!command.prompt.trim()) return;
      setPanel("chat");
      setFocusToken((value) => value + 1);
      void handleSend(command.prompt);
    },
    [handleSend],
  );

  const handleShortcut = useCallback(
    (action: ShortcutAction | string) => {
      if (action === "toggleChat") {
        setPanel((value) => (value === "chat" ? "none" : "chat"));
        setFocusToken((value) => value + 1);
        return;
      }
      if (action === "hidePet") {
        hidePet();
        return;
      }
      if (action === "centerPet") {
        void centerAppWindow();
        triggerPet("onClick", labels.pet.back);
        return;
      }
      if (action === "quickAsk") {
        openChat();
        return;
      }
      if (action.startsWith("quickCommand:")) {
        const commandId = action.replace("quickCommand:", "");
        const command = config.quickCommands.find((item) => item.id === commandId);
        if (command) runQuickCommand(command);
      }
    },
    [config.quickCommands, hidePet, labels.pet.back, openChat, runQuickCommand, triggerPet],
  );

  useEffect(() => {
    void loadConfigWithStartupState().then(async (nextConfig) => {
      setConfig(nextConfig);
      setMessages(loadChatHistory());
      const providerIds = Object.keys(nextConfig.providers) as ProviderId[];
      const nextKeys: Partial<Record<ProviderId, string>> = {};
      await Promise.all(
        providerIds.map(async (providerId) => {
          nextKeys[providerId] = await getApiKey(providerId);
        }),
      );
      setApiKeys(nextKeys);
      loadedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    void saveConfig(config);
  }, [config]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return undefined;
    const channel = new BroadcastChannel(CONFIG_CHANNEL);
    channel.onmessage = (event) => {
      setConfig(mergeConfig(event.data as Partial<WorkBuddyConfig>));
    };
    return () => channel.close();
  }, []);

  useEffect(() => {
    void loadPetManifest()
      .then((manifest) => Promise.all(manifest.pets.map((entry) => loadPetPack(entry.path))))
      .then(setPetCatalog)
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, []);

  useEffect(() => {
    void loadPetPackById(config.activePetId)
      .then((pack) => {
        setPetPack(pack);
        setPetAction(pack.defaultAnimation);
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : String(error)));
  }, [config.activePetId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!busy && panel === "none") {
        setPetAction(randomIdleAction(petPack));
      }
    }, 9000);
    return () => window.clearInterval(timer);
  }, [busy, panel, petPack]);

  useEffect(() => {
    if (!loadedRef.current) return;
    void registerConfiguredShortcuts(config);
  }, [config]);

  useEffect(() => {
    return () => {
      reminderTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const mode = panel === "chat" ? "chat" : "pet";
    void setDesktopWindowMode(mode, config.appearance.petSize);
  }, [config.appearance.petSize, panel]);

  useEffect(() => {
    let disposeShortcut: () => void = () => undefined;
    let disposeTray: () => void = () => undefined;

    void listenTauriEvent<string>("workbuddy://shortcut", handleShortcut).then((dispose) => {
      disposeShortcut = dispose;
    });
    void listenTauriEvent<string>("workbuddy://tray", (payload) => {
      if (payload === "showChat") openChat();
      if (payload === "showSettings") openSettings();
    }).then((dispose) => {
      disposeTray = dispose;
    });

    return () => {
      disposeShortcut();
      disposeTray();
    };
  }, [handleShortcut, openChat, openSettings]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const [action, shortcut] of shortcutEntries(config)) {
        if (shortcut && matchesShortcut(event, shortcut)) {
          event.preventDefault();
          handleShortcut(action);
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config, handleShortcut]);

  async function handleApiKeyChange(provider: ProviderId, value: string) {
    setApiKeys((current) => ({ ...current, [provider]: value }));
    await setApiKey(provider, value);
  }

  async function handleApiKeyDelete(provider: ProviderId) {
    setApiKeys((current) => ({ ...current, [provider]: "" }));
    await deleteApiKey(provider);
  }

  function handleSave() {
    void saveConfig(config);
    void registerConfiguredShortcuts(config);
    setStatus("Saved");
    triggerPet("onClick", labels.pet.saved);
  }

  return (
    <main
      className={`app-shell panel-${panel}`}
      style={{ "--pet-size": `${config.appearance.petSize}px` } as CSSProperties}
    >
      <PetWindow
        pack={petPack}
        action={petAction}
        bubble={bubble}
        labels={labels.pet}
        petSize={config.appearance.petSize}
        toolbarHidden={toolbarHidden}
        onClickPet={() => {
          if (toolbarHidden) {
            setToolbarHidden(false);
            return;
          }
          playPetClickAction();
        }}
        onOpenChat={toggleChat}
        onOpenSettings={openSettings}
        onHide={hidePet}
        onToggleToolbar={() => setToolbarHidden((value) => !value)}
        onDragStart={() => triggerPet("onDragStart")}
        onDragEnd={() => triggerPet("onDragEnd")}
      />

      {panel === "chat" ? (
        <ChatWindow
          config={config}
          messages={messages}
          busy={busy}
          focusToken={focusToken}
          labels={labels.chat}
          computerLabels={labels.computer}
          computerTask={computerTask}
          onSend={handleSend}
          onRunQuickCommand={runQuickCommand}
          onConfirmComputerTask={confirmComputerTask}
          onCancelComputerTask={cancelComputerTask}
          onOpenSettings={openSettings}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {panel === "settings" ? (
        <SettingsWindow
          config={config}
          pets={petCatalog}
          apiKeys={apiKeys}
          labels={labels}
          onConfigChange={updateConfig}
          onApiKeyChange={handleApiKeyChange}
          onApiKeyDelete={handleApiKeyDelete}
          onSave={handleSave}
          onClose={() => setPanel("none")}
        />
      ) : null}
    </main>
  );
}

function SettingsApp() {
  const [config, setConfig] = useState<WorkBuddyConfig>(defaultConfig);
  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [petCatalog, setPetCatalog] = useState<LoadedPetPack[]>([]);
  const labels = translations[config.appearance.language];

  const updateConfig = useCallback((next: WorkBuddyConfig) => {
    setConfig(next);
    void saveConfig(next);
    publishConfig(next);
  }, []);

  useEffect(() => {
    void loadConfigWithStartupState().then(async (nextConfig) => {
      setConfig(nextConfig);
      const providerIds = Object.keys(nextConfig.providers) as ProviderId[];
      const nextKeys: Partial<Record<ProviderId, string>> = {};
      await Promise.all(
        providerIds.map(async (providerId) => {
          nextKeys[providerId] = await getApiKey(providerId);
        }),
      );
      setApiKeys(nextKeys);
    });
  }, []);

  useEffect(() => {
    void loadPetManifest()
      .then((manifest) => Promise.all(manifest.pets.map((entry) => loadPetPack(entry.path))))
      .then(setPetCatalog)
      .catch(() => setPetCatalog([]));
  }, []);

  async function handleApiKeyChange(provider: ProviderId, value: string) {
    setApiKeys((current) => ({ ...current, [provider]: value }));
    await setApiKey(provider, value);
  }

  async function handleApiKeyDelete(provider: ProviderId) {
    setApiKeys((current) => ({ ...current, [provider]: "" }));
    await deleteApiKey(provider);
  }

  function handleSave() {
    void saveConfig(config);
    publishConfig(config);
    void registerConfiguredShortcuts(config);
  }

  return (
    <main className="settings-shell">
      <SettingsWindow
        config={config}
        pets={petCatalog}
        apiKeys={apiKeys}
        labels={labels}
        onConfigChange={updateConfig}
        onApiKeyChange={handleApiKeyChange}
        onApiKeyDelete={handleApiKeyDelete}
        onSave={handleSave}
        onClose={() => void closeCurrentWindow()}
      />
    </main>
  );
}
