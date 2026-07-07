import { Plus, Trash2 } from "lucide-react";
import type { QuickCommand, WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import { ShortcutRecorder } from "../shortcuts/ShortcutRecorder";

type ShortcutSettingsProps = {
  config: WorkBuddyConfig;
  labels: Translations["shortcuts"];
  onConfigChange: (config: WorkBuddyConfig) => void;
};

export function ShortcutSettings({ config, labels, onConfigChange }: ShortcutSettingsProps) {
  function updateShortcut(key: keyof WorkBuddyConfig["shortcuts"], value: string) {
    onConfigChange({
      ...config,
      shortcuts: {
        ...config.shortcuts,
        [key]: value,
      },
    });
  }

  function updateCommand(index: number, next: QuickCommand) {
    const quickCommands = [...config.quickCommands];
    quickCommands[index] = next;
    onConfigChange({ ...config, quickCommands });
  }

  function addCommand() {
    onConfigChange({
      ...config,
      quickCommands: [
        ...config.quickCommands,
        {
          id: `command-${Date.now()}`,
          name: labels.newCommand,
          shortcut: "",
          prompt: "",
        },
      ],
    });
  }

  function removeCommand(index: number) {
    onConfigChange({
      ...config,
      quickCommands: config.quickCommands.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  return (
    <div className="settings-stack">
      <section className="settings-group">
        <h3>{labels.global}</h3>
        <div className="shortcut-grid">
          <span>{labels.toggleChat}</span>
          <ShortcutRecorder
            value={config.shortcuts.toggleChat}
            onChange={(value) => updateShortcut("toggleChat", value)}
          />
          <span>{labels.hidePet}</span>
          <ShortcutRecorder
            value={config.shortcuts.hidePet}
            onChange={(value) => updateShortcut("hidePet", value)}
          />
          <span>{labels.centerPet}</span>
          <ShortcutRecorder
            value={config.shortcuts.centerPet}
            onChange={(value) => updateShortcut("centerPet", value)}
          />
          <span>{labels.quickAsk}</span>
          <ShortcutRecorder
            value={config.shortcuts.quickAsk}
            onChange={(value) => updateShortcut("quickAsk", value)}
          />
        </div>
      </section>

      <section className="settings-group">
        <header>
          <h3>{labels.quickCommands}</h3>
          <button type="button" onClick={addCommand}>
            <Plus size={15} />
            {labels.add}
          </button>
        </header>

        <div className="command-list">
          {config.quickCommands.map((command, index) => (
            <article className="command-editor" key={command.id}>
              <label className="field">
                <span>{labels.name}</span>
                <input
                  value={command.name}
                  onChange={(event) =>
                    updateCommand(index, { ...command, name: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>{labels.shortcut}</span>
                <ShortcutRecorder
                  value={command.shortcut}
                  onChange={(value) => updateCommand(index, { ...command, shortcut: value })}
                />
              </label>
              <label className="field command-prompt">
                <span>{labels.prompt}</span>
                <textarea
                  rows={2}
                  value={command.prompt}
                  onChange={(event) =>
                    updateCommand(index, { ...command, prompt: event.target.value })
                  }
                />
              </label>
              <button type="button" title={labels.remove} onClick={() => removeCommand(index)}>
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
