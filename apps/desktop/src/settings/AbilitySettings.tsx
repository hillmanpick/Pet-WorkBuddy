import type { WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import { setLaunchOnStartup } from "../tauri/tauriClient";

type AbilitySettingsProps = {
  config: WorkBuddyConfig;
  labels: Translations["abilities"];
  onConfigChange: (config: WorkBuddyConfig) => void;
};

export function AbilitySettings({ config, labels, onConfigChange }: AbilitySettingsProps) {
  function updateComputerControl(value: Partial<WorkBuddyConfig["computerControl"]>) {
    onConfigChange({
      ...config,
      computerControl: {
        ...config.computerControl,
        ...value,
      },
    });
  }

  function updateBehavior(value: Partial<WorkBuddyConfig["behavior"]>) {
    const next = {
      ...config,
      behavior: {
        ...config.behavior,
        ...value,
      },
    };
    onConfigChange(next);

    if (typeof value.launchOnStartup === "boolean") {
      void setLaunchOnStartup(value.launchOnStartup);
    }
  }

  return (
    <div className="settings-stack">
      <section className="settings-group">
        <h3>{labels.system}</h3>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={config.behavior.launchOnStartup}
            onChange={(event) => updateBehavior({ launchOnStartup: event.target.checked })}
          />
          <span>{labels.launchOnStartup}</span>
        </label>
        <p className="settings-note">{labels.launchOnStartupNote}</p>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={config.behavior.doNotDisturb}
            onChange={(event) => updateBehavior({ doNotDisturb: event.target.checked })}
          />
          <span>{labels.doNotDisturb}</span>
        </label>
        <p className="settings-note">{labels.doNotDisturbNote}</p>
      </section>

      <section className="settings-group">
        <h3>{labels.computerControl}</h3>
        <p className="settings-help">{labels.description}</p>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={config.computerControl.enabled}
            onChange={(event) => updateComputerControl({ enabled: event.target.checked })}
          />
          <span>{labels.enableComputerControl}</span>
        </label>

        <label className="field">
          <span>{labels.authorizationMode}</span>
          <select
            value={config.computerControl.authorizationMode}
            onChange={(event) =>
              updateComputerControl({
                authorizationMode: event.target.value as WorkBuddyConfig["computerControl"]["authorizationMode"],
              })
            }
          >
            <option value="confirmSensitive">{labels.confirmSensitive}</option>
            <option value="fullAccess">{labels.fullAccess}</option>
            <option value="denySensitive">{labels.denySensitive}</option>
          </select>
        </label>

        <p className="settings-note">
          {config.computerControl.authorizationMode === "fullAccess"
            ? labels.fullAccessDescription
            : config.computerControl.authorizationMode === "denySensitive"
              ? labels.denySensitiveDescription
              : labels.confirmSensitiveDescription}
        </p>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={config.computerControl.allowWechatSend}
            onChange={(event) => updateComputerControl({ allowWechatSend: event.target.checked })}
          />
          <span>{labels.allowWechatSend}</span>
        </label>
        <p className="settings-note">{labels.safety}</p>
      </section>
    </div>
  );
}
