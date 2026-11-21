import { Check, ChevronDown, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ProviderId, WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import { fetchProviderModels } from "../providers/ModelCatalog";

type ProviderSettingsProps = {
  config: WorkBuddyConfig;
  apiKeys: Partial<Record<ProviderId, string>>;
  labels: Translations["providers"];
  onConfigChange: (config: WorkBuddyConfig) => void;
  onApiKeyChange: (provider: ProviderId, value: string) => void;
  onApiKeyDelete: (provider: ProviderId) => void;
};

const providerIds: ProviderId[] = ["openai", "claude", "deepseek"];

export function ProviderSettings({
  config,
  apiKeys,
  labels,
  onConfigChange,
  onApiKeyChange,
  onApiKeyDelete,
}: ProviderSettingsProps) {
  const [modelOptions, setModelOptions] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [modelStatus, setModelStatus] = useState<Partial<Record<ProviderId, "loaded" | "error">>>({});
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);
  const [openModelProvider, setOpenModelProvider] = useState<ProviderId | null>(null);
  const [modelSearch, setModelSearch] = useState("");

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

  async function refreshModels(providerId: ProviderId) {
    const provider = config.providers[providerId];
    setLoadingProvider(providerId);
    setModelStatus((current) => ({ ...current, [providerId]: undefined }));
    try {
      const models = await fetchProviderModels(providerId, provider.baseUrl, apiKeys[providerId] ?? "");
      setModelOptions((current) => ({ ...current, [providerId]: models }));
      setModelStatus((current) => ({ ...current, [providerId]: "loaded" }));
      setOpenModelProvider(providerId);
      setModelSearch("");
    } catch {
      setModelStatus((current) => ({ ...current, [providerId]: "error" }));
    } finally {
      setLoadingProvider(null);
    }
  }

  return (
    <div className="settings-stack">
      <label className="field">
        <span>{labels.activeProvider}</span>
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
                {labels.enabled}
              </label>
            </header>

            <div className="settings-grid">
              <label className="field">
                <span>{labels.displayName}</span>
                <input
                  value={provider.displayName}
                  onChange={(event) => updateProvider(providerId, "displayName", event.target.value)}
                />
              </label>
              <label className="field">
                <span>{labels.baseUrl}</span>
                <input
                  value={provider.baseUrl}
                  onChange={(event) => updateProvider(providerId, "baseUrl", event.target.value)}
                />
              </label>
              <label className="field">
                <span>{labels.modelId}</span>
                <div className="model-picker">
                  <div className="model-picker-input">
                    <input
                      aria-label={labels.modelId}
                      value={provider.modelId}
                      onChange={(event) => updateProvider(providerId, "modelId", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setOpenModelProvider(null);
                      }}
                    />
                    <button
                      type="button"
                      className="model-picker-toggle"
                      title={labels.chooseModel}
                      aria-label={`${labels.chooseModel}: ${provider.displayName}`}
                      aria-expanded={openModelProvider === providerId}
                      onClick={() => {
                        setModelSearch("");
                        setOpenModelProvider(openModelProvider === providerId ? null : providerId);
                      }}
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="model-picker-refresh"
                      title={labels.refreshModels}
                      aria-label={`${labels.refreshModels}: ${provider.displayName}`}
                      disabled={loadingProvider !== null || !apiKeys[providerId]?.trim()}
                      onClick={() => void refreshModels(providerId)}
                    >
                      <RefreshCw size={15} className={loadingProvider === providerId ? "spin" : ""} />
                    </button>
                  </div>
                  {openModelProvider === providerId ? (
                    <div className="model-options-popup">
                      <input
                        className="model-options-search"
                        aria-label={labels.searchModels}
                        placeholder={labels.searchModels}
                        value={modelSearch}
                        onChange={(event) => setModelSearch(event.target.value)}
                      />
                      <div className="model-options-list" role="listbox" aria-label={labels.chooseModel}>
                        {(modelOptions[providerId] ?? [])
                          .filter((modelId) => modelId.toLowerCase().includes(modelSearch.trim().toLowerCase()))
                          .map((modelId) => (
                            <button
                              className="model-option"
                              key={modelId}
                              type="button"
                              role="option"
                              aria-selected={modelId === provider.modelId}
                              onClick={() => {
                                updateProvider(providerId, "modelId", modelId);
                                setOpenModelProvider(null);
                                setModelSearch("");
                              }}
                            >
                              <span>{modelId}</span>
                              {modelId === provider.modelId ? <Check size={14} /> : null}
                            </button>
                          ))}
                        {!modelOptions[providerId]?.length ? (
                          <p className="model-options-empty">{labels.noModelsLoaded}</p>
                        ) : null}
                        {modelOptions[providerId]?.length && !modelOptions[providerId]?.some((modelId) => modelId.toLowerCase().includes(modelSearch.trim().toLowerCase())) ? (
                          <p className="model-options-empty">{labels.noModelsFound}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
                {modelStatus[providerId] === "loaded" ? (
                  <small className="model-catalog-status">{labels.modelCount(modelOptions[providerId]?.length ?? 0)}</small>
                ) : null}
                {modelStatus[providerId] === "error" ? (
                  <small className="model-catalog-status error">{labels.modelLoadFailed}</small>
                ) : null}
              </label>
              {providerId === "openai" ? (
                <label className="field">
                  <span>{labels.reasoningEffort}</span>
                  <select
                    value={provider.reasoningEffort ?? "medium"}
                    onChange={(event) => updateProvider(providerId, "reasoningEffort", event.target.value)}
                  >
                    <option value="none">{labels.reasoningNone}</option>
                    <option value="minimal">{labels.reasoningMinimal}</option>
                    <option value="low">{labels.reasoningLow}</option>
                    <option value="medium">{labels.reasoningMedium}</option>
                    <option value="high">{labels.reasoningHigh}</option>
                    <option value="xhigh">{labels.reasoningExtraHigh}</option>
                  </select>
                </label>
              ) : null}
              <label className="field">
                <span>{labels.imageInputMode}</span>
                <select
                  value={provider.imageInputMode ?? "auto"}
                  onChange={(event) => updateProvider(providerId, "imageInputMode", event.target.value)}
                >
                  <option value="auto">{labels.imageInputModeAuto}</option>
                  <option value="enabled">{labels.imageInputModeEnabled}</option>
                  <option value="disabled">{labels.imageInputModeDisabled}</option>
                </select>
              </label>
              <label className="field">
                <span>{labels.apiKey}</span>
                <div className="inline-input">
                  <KeyRound size={15} />
                  <input
                    type="password"
                    value={apiKeys[providerId] ?? ""}
                    placeholder={labels.storedLocally}
                    onChange={(event) => onApiKeyChange(providerId, event.target.value)}
                  />
                  <button type="button" title={labels.deleteKey} onClick={() => onApiKeyDelete(providerId)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </label>
              <label className="field">
                <span>{labels.temperature}</span>
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
                <span>{labels.maxTokens}</span>
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
              <span>{labels.systemPrompt}</span>
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
