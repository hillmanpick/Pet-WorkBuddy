import { Check, LoaderCircle, Save, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ProviderId, WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { ProviderSettings } from "../settings/ProviderSettings";
import { PetSettings } from "../settings/PetSettings";
import { ShortcutSettings } from "../settings/ShortcutSettings";
import { AbilitySettings } from "../settings/AbilitySettings";
import { ChatHistorySettings } from "../settings/ChatHistorySettings";
import { AgentSettings } from "../settings/AgentSettings";

type SettingsWindowProps = {
  config: WorkBuddyConfig;
  pets: LoadedPetPack[];
  apiKeys: Partial<Record<ProviderId, string>>;
  labels: Translations;
  onConfigChange: (config: WorkBuddyConfig) => void;
  onApiKeyChange: (provider: ProviderId, value: string) => void;
  onApiKeyDelete: (provider: ProviderId) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  onPetCatalogChange?: (activePetId?: string) => void;
};

type SettingsTab = "providers" | "pets" | "shortcuts" | "abilities" | "agent" | "history";

export function SettingsWindow({
  config,
  pets,
  apiKeys,
  labels,
  onConfigChange,
  onApiKeyChange,
  onApiKeyDelete,
  onSave,
  onClose,
  onPetCatalogChange,
}: SettingsWindowProps) {
  const [tab, setTab] = useState<SettingsTab>("providers");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setSaveState("idle");
    setSaveError("");
  }, [config]);

  async function save() {
    setSaveState("saving");
    setSaveError("");
    try {
      await onSave();
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : labels.settings.saveFailed);
    }
  }

  return (
    <section className="panel settings-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">{labels.settings.kicker}</span>
          <h2>
            <SlidersHorizontal size={18} />
            {labels.settings.title}
          </h2>
        </div>
        <div className="panel-actions">
          <button type="button" title={labels.settings.save} aria-label={labels.settings.save} disabled={saveState === "saving"} onClick={() => void save()}>
            {saveState === "saving" ? <LoaderCircle className="spin" size={17} /> : saveState === "saved" ? <Check size={17} /> : <Save size={17} />}
          </button>
          <button type="button" title={labels.settings.close} onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      </header>

      {saveState !== "idle" ? (
        <div className={`settings-save-feedback ${saveState}`} role="status" aria-live="polite">
          {saveState === "saving" ? labels.settings.saving : saveState === "saved" ? labels.settings.saved : `${labels.settings.saveFailed}: ${saveError}`}
        </div>
      ) : null}

      <div className="tabs">
        <button className={tab === "providers" ? "active" : ""} type="button" onClick={() => setTab("providers")}>
          {labels.settings.providers}
        </button>
        <button className={tab === "pets" ? "active" : ""} type="button" onClick={() => setTab("pets")}>
          {labels.settings.pets}
        </button>
        <button className={tab === "shortcuts" ? "active" : ""} type="button" onClick={() => setTab("shortcuts")}>
          {labels.settings.shortcuts}
        </button>
        <button className={tab === "abilities" ? "active" : ""} type="button" onClick={() => setTab("abilities")}>
          {labels.settings.abilities}
        </button>
        <button className={tab === "agent" ? "active" : ""} type="button" onClick={() => setTab("agent")}>
          {labels.settings.agent}
        </button>
        <button className={tab === "history" ? "active" : ""} type="button" onClick={() => setTab("history")}>
          {labels.settings.history}
        </button>
      </div>

      <div className="settings-body">
        {tab === "providers" ? (
          <ProviderSettings
            config={config}
            apiKeys={apiKeys}
            labels={labels.providers}
            onConfigChange={onConfigChange}
            onApiKeyChange={onApiKeyChange}
            onApiKeyDelete={onApiKeyDelete}
          />
        ) : null}
        {tab === "pets" ? (
          <PetSettings
            config={config}
            pets={pets}
            labels={labels.pets}
            onConfigChange={onConfigChange}
            onPetCatalogChange={onPetCatalogChange}
          />
        ) : null}
        {tab === "shortcuts" ? (
          <ShortcutSettings config={config} labels={labels.shortcuts} onConfigChange={onConfigChange} />
        ) : null}
        {tab === "abilities" ? (
          <AbilitySettings config={config} labels={labels.abilities} onConfigChange={onConfigChange} />
        ) : null}
        {tab === "agent" ? (
          <AgentSettings config={config} labels={labels.agent} onConfigChange={onConfigChange} />
        ) : null}
        {tab === "history" ? <ChatHistorySettings labels={labels.history} /> : null}
      </div>
    </section>
  );
}
