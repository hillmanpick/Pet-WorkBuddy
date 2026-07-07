import { Save, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import type { ProviderId, WorkBuddyConfig } from "../config/schema";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { ProviderSettings } from "../settings/ProviderSettings";
import { PetSettings } from "../settings/PetSettings";
import { ShortcutSettings } from "../settings/ShortcutSettings";

type SettingsWindowProps = {
  config: WorkBuddyConfig;
  pets: LoadedPetPack[];
  apiKeys: Partial<Record<ProviderId, string>>;
  onConfigChange: (config: WorkBuddyConfig) => void;
  onApiKeyChange: (provider: ProviderId, value: string) => void;
  onApiKeyDelete: (provider: ProviderId) => void;
  onSave: () => void;
  onClose: () => void;
};

type SettingsTab = "providers" | "pets" | "shortcuts";

export function SettingsWindow({
  config,
  pets,
  apiKeys,
  onConfigChange,
  onApiKeyChange,
  onApiKeyDelete,
  onSave,
  onClose,
}: SettingsWindowProps) {
  const [tab, setTab] = useState<SettingsTab>("providers");

  return (
    <section className="panel settings-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">Local settings</span>
          <h2>
            <SlidersHorizontal size={18} />
            WorkBuddy Settings
          </h2>
        </div>
        <div className="panel-actions">
          <button type="button" title="Save" onClick={onSave}>
            <Save size={17} />
          </button>
          <button type="button" title="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="tabs">
        <button className={tab === "providers" ? "active" : ""} type="button" onClick={() => setTab("providers")}>
          Providers
        </button>
        <button className={tab === "pets" ? "active" : ""} type="button" onClick={() => setTab("pets")}>
          Pets
        </button>
        <button className={tab === "shortcuts" ? "active" : ""} type="button" onClick={() => setTab("shortcuts")}>
          Shortcuts
        </button>
      </div>

      <div className="settings-body">
        {tab === "providers" ? (
          <ProviderSettings
            config={config}
            apiKeys={apiKeys}
            onConfigChange={onConfigChange}
            onApiKeyChange={onApiKeyChange}
            onApiKeyDelete={onApiKeyDelete}
          />
        ) : null}
        {tab === "pets" ? <PetSettings config={config} pets={pets} onConfigChange={onConfigChange} /> : null}
        {tab === "shortcuts" ? (
          <ShortcutSettings config={config} onConfigChange={onConfigChange} />
        ) : null}
      </div>
    </section>
  );
}

