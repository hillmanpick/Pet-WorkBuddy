import { Plus, Trash2 } from "lucide-react";
import type { QuickCommand, WorkBuddyConfig } from "../config/schema";
import { ShortcutRecorder } from "../shortcuts/ShortcutRecorder";

type ShortcutSettingsProps = {
  config: WorkBuddyConfig;
  onConfigChange: (config: WorkBuddyConfig) => void;
};

export function ShortcutSettings({ config, onConfigChange }: ShortcutSettingsProps) {
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
          name: "New Command",
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
        <h3>Global shortcuts</h3>
        <div className="shortcut-grid">
          <span>Toggle chat</span>
          <ShortcutRecorder
            value={config.shortcuts.toggleChat}
            onChange={(value) => updateShortcut("toggleChat", value)}
          />
          <span>Hide pet</span>
          <ShortcutRecorder
            value={config.shortcuts.hidePet}
            onChange={(value) => updateShortcut("hidePet", value)}
          />
          <span>Center pet</span>
          <ShortcutRecorder
            value={config.shortcuts.centerPet}
            onChange={(value) => updateShortcut("centerPet", value)}
          />
          <span>Quick ask</span>
          <ShortcutRecorder
            value={config.shortcuts.quickAsk}
            onChange={(value) => updateShortcut("quickAsk", value)}
          />
        </div>
      </section>

      <section className="settings-group">
        <header>
          <h3>Quick commands</h3>
          <button type="button" onClick={addCommand}>
            <Plus size={15} />
            Add
          </button>
        </header>

        <div className="command-list">
          {config.quickCommands.map((command, index) => (
            <article className="command-editor" key={command.id}>
              <label className="field">
                <span>Name</span>
                <input
                  value={command.name}
                  onChange={(event) =>
                    updateCommand(index, { ...command, name: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Shortcut</span>
                <ShortcutRecorder
                  value={command.shortcut}
                  onChange={(value) => updateCommand(index, { ...command, shortcut: value })}
                />
              </label>
              <label className="field command-prompt">
                <span>Prompt</span>
                <textarea
                  rows={2}
                  value={command.prompt}
                  onChange={(event) =>
                    updateCommand(index, { ...command, prompt: event.target.value })
                  }
                />
              </label>
              <button type="button" title="Remove" onClick={() => removeCommand(index)}>
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

