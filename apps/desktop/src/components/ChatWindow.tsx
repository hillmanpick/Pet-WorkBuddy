import { Bot, Settings, X } from "lucide-react";
import type { ChatMessage, QuickCommand, WorkBuddyConfig } from "../config/schema";
import { MessageList } from "../chat/MessageList";
import { PromptBox } from "../chat/PromptBox";

type ChatWindowProps = {
  config: WorkBuddyConfig;
  messages: ChatMessage[];
  busy: boolean;
  focusToken: number;
  onSend: (message: string) => void;
  onRunQuickCommand: (command: QuickCommand) => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

export function ChatWindow({
  config,
  messages,
  busy,
  focusToken,
  onSend,
  onRunQuickCommand,
  onOpenSettings,
  onClose,
}: ChatWindowProps) {
  const provider = config.providers[config.activeProvider];

  return (
    <section className="panel chat-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">{provider.displayName}</span>
          <h2>
            <Bot size={18} />
            WorkBuddy Chat
          </h2>
        </div>
        <div className="panel-actions">
          <button type="button" title="Settings" onClick={onOpenSettings}>
            <Settings size={17} />
          </button>
          <button type="button" title="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      </header>

      <MessageList messages={messages} />

      <div className="quick-command-row">
        {config.quickCommands.map((command) => (
          <button
            key={command.id}
            type="button"
            disabled={busy}
            onClick={() => onRunQuickCommand(command)}
          >
            {command.name}
          </button>
        ))}
      </div>

      <PromptBox disabled={busy} focusToken={focusToken} onSend={onSend} />
    </section>
  );
}

