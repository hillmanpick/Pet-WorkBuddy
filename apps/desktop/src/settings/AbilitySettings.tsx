import type { WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";

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

  return (
    <div className="settings-stack">
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
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={config.computerControl.requireConfirmation}
            onChange={(event) => updateComputerControl({ requireConfirmation: event.target.checked })}
          />
          <span>{labels.requireConfirmation}</span>
        </label>
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
