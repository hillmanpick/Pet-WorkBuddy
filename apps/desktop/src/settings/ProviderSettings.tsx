import { KeyRound, Trash2 } from "lucide-react";
import type { ProviderId, WorkBuddyConfig } from "../config/schema";

type ProviderSettingsProps = {
  config: WorkBuddyConfig;
  apiKeys: Partial<Record<ProviderId, string>>;
  onConfigChange: (config: WorkBuddyConfig) => void;
  onApiKeyChange: (provider: ProviderId, value: string) => void;
  onApiKeyDelete: (provider: ProviderId) => void;
};

const providerIds: ProviderId[] = ["openai", "claude", "deepseek"];

export function ProviderSettings({
  config,
  apiKeys,
  onConfigChange,
  onApiKeyChange,
  onApiKeyDelete,
}: ProviderSettingsProps) {
  function updateProvider(providerId: ProviderId, key: string, value: string | number | boolean) {
    onConfigChange({
      ...config,
      providers: {
        ...config.providers,
        [providerId]: {
          ...config.providers[providerId],
          [key]: value,
        },
      },
    });
  }

  return (
    <div className="settings-stack">
      <label className="field">
        <span>Active provider</span>
        <select
          value={config.activeProvider}
          onChange={(event) =>
            onConfigChange({ ...config, activeProvider: event.target.value as ProviderId })
          }
        >
          {providerIds.map((providerId) => (
            <option key={providerId} value={providerId}>
              {config.providers[providerId].displayName}
            </option>
          ))}
        </select>
      </label>

      {providerIds.map((providerId) => {
        const provider = config.providers[providerId];
        return (
          <section className="settings-group" key={providerId}>
            <header>
              <h3>{provider.displayName}</h3>
              <label className="toggle-field">
                <input
                  type="checkbox"
                  checked={provider.enabled}
                  onChange={(event) => updateProvider(providerId, "enabled", event.target.checked)}
                />
                Enabled
              </label>
            </header>

            <div className="settings-grid">
              <label className="field">
                <span>Display name</span>
                <input
                  value={provider.displayName}
                  onChange={(event) => updateProvider(providerId, "displayName", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Base URL</span>
                <input
                  value={provider.baseUrl}
                  onChange={(event) => updateProvider(providerId, "baseUrl", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Model ID</span>
                <input
                  value={provider.modelId}
                  onChange={(event) => updateProvider(providerId, "modelId", event.target.value)}
                />
              </label>
              <label className="field">
                <span>API Key</span>
                <div className="inline-input">
                  <KeyRound size={15} />
                  <input
                    type="password"
                    value={apiKeys[providerId] ?? ""}
                    placeholder="Stored locally"
                    onChange={(event) => onApiKeyChange(providerId, event.target.value)}
                  />
                  <button type="button" title="Delete key" onClick={() => onApiKeyDelete(providerId)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </label>
              <label className="field">
                <span>Temperature</span>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={provider.temperature}
                  onChange={(event) =>
                    updateProvider(providerId, "temperature", Number(event.target.value))
                  }
                />
              </label>
              <label className="field">
                <span>Max tokens</span>
                <input
                  type="number"
                  min={128}
                  step={128}
                  value={provider.maxTokens}
                  onChange={(event) =>
                    updateProvider(providerId, "maxTokens", Number(event.target.value))
                  }
                />
              </label>
            </div>

            <label className="field">
              <span>System prompt</span>
              <textarea
                rows={3}
                value={provider.systemPrompt}
                onChange={(event) => updateProvider(providerId, "systemPrompt", event.target.value)}
              />
            </label>
          </section>
        );
      })}
    </div>
  );
}

