import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ProviderId, QuickCommand, WorkBuddyConfig } from "../config/schema";
import { defaultConfig } from "../config/defaultConfig";
import { ChatWindow } from "../components/ChatWindow";
import { PetWindow } from "../components/PetWindow";
import { SettingsWindow } from "../components/SettingsWindow";
import { createMessage, requestAssistantReply } from "../chat/ChatController";
import { loadChatHistory, saveChatHistory } from "../chat/ChatStore";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { loadPetManifest, loadPetPack, loadPetPackById } from "../pet/PetPackLoader";
import { nextPetAction, randomIdleAction } from "../pet/PetRuntime";
import type { PetEvent } from "../pet/PetStateMachine";
import {
  centerAppWindow,
  hideAppWindow,
  isElectronRuntime,
  isTauriRuntime,
  listenTauriEvent,
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

export function App() {
  const [config, setConfig] = useState<WorkBuddyConfig>(defaultConfig);
  const [apiKeys, setApiKeys] = useState<Partial<Record<ProviderId, string>>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [petPack, setPetPack] = useState<LoadedPetPack | null>(null);
  const [petCatalog, setPetCatalog] = useState<LoadedPetPack[]>([]);
  const [petAction, setPetAction] = useState("idle");
  const [bubble, setBubble] = useState<string | undefined>("Hi, I'm WorkBuddy.");
  const [panel, setPanel] = useState<Panel>("none");
  const [busy, setBusy] = useState(false);
  const [focusToken, setFocusToken] = useState(0);
  const [status, setStatus] = useState("Ready");
  const loadedRef = useRef(false);

  const updateConfig = useCallback((next: WorkBuddyConfig) => {
    setConfig(next);
    void saveConfig(next);
  }, []);

  const triggerPet = useCallback(
    (event: PetEvent, overrideBubble?: string) => {
      const next = nextPetAction(petPack, event);
      setPetAction(next.action);
      setBubble(overrideBubble ?? next.bubble);
      window.setTimeout(() => setBubble(undefined), 3500);
    },
    [petPack],
  );

  const openChat = useCallback(() => {
    setPanel("chat");
    setFocusToken((value) => value + 1);
    triggerPet("onChatOpen", "I'm listening.");
  }, [triggerPet]);

  const openSettings = useCallback(() => {
    setPanel("settings");
    void showAppWindow();
  }, []);

  const hidePet = useCallback(() => {
    if (isTauriRuntime()) {
      void hideAppWindow();
    } else {
      setPanel("none");
      setBubble("Browser preview cannot hide the desktop window.");
    }
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (busy) return;

      const userMessage = createMessage("user", text);
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      saveChatHistory(nextMessages);
      setBusy(true);
      setStatus("Thinking");
      triggerPet("onUserSendMessage", "Thinking...");

      try {
        const reply = await requestAssistantReply(config, nextMessages);
        const assistantMessage = createMessage("assistant", reply || "(empty reply)");
        const finalMessages = [...nextMessages, assistantMessage];
        setMessages(finalMessages);
        saveChatHistory(finalMessages);
        triggerPet("onAiReplyEnd", "Done.");
        setStatus("Ready");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const assistantMessage = createMessage("assistant", `Error: ${message}`);
        const finalMessages = [...nextMessages, assistantMessage];
        setMessages(finalMessages);
        saveChatHistory(finalMessages);
        triggerPet("onError", "I need a valid API key.");
        setStatus("Provider error");
      } finally {
        setBusy(false);
      }
    },
    [busy, config, messages, triggerPet],
  );

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
        triggerPet("onClick", "I'm back.");
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
    [config.quickCommands, hidePet, openChat, runQuickCommand, triggerPet],
  );

  useEffect(() => {
    void loadConfig().then(async (nextConfig) => {
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
    triggerPet("onClick", "Settings saved.");
  }

  return (
    <main className="app-shell">
      <PetWindow
        pack={petPack}
        action={petAction}
        bubble={bubble}
        onClickPet={() => triggerPet("onClick", "Hey!")}
        onOpenChat={openChat}
        onOpenSettings={openSettings}
        onHide={hidePet}
        onDragStart={() => triggerPet("onDragStart")}
        onDragEnd={() => triggerPet("onDragEnd")}
      />

      {panel === "chat" ? (
        <ChatWindow
          config={config}
          messages={messages}
          busy={busy}
          focusToken={focusToken}
          onSend={handleSend}
          onRunQuickCommand={runQuickCommand}
          onOpenSettings={openSettings}
          onClose={() => setPanel("none")}
        />
      ) : null}

      {panel === "settings" ? (
        <SettingsWindow
          config={config}
          pets={petCatalog}
          apiKeys={apiKeys}
          onConfigChange={updateConfig}
          onApiKeyChange={handleApiKeyChange}
          onApiKeyDelete={handleApiKeyDelete}
          onSave={handleSave}
          onClose={() => setPanel("none")}
        />
      ) : null}

      <footer className="status-bar">
        <span>{status}</span>
        <span>{isTauriRuntime() || isElectronRuntime() ? "Desktop" : "Browser preview"}</span>
      </footer>
    </main>
  );
}
