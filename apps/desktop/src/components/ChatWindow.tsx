import type { ChatMessage, QuickCommand, WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";
import { PromptBox } from "../chat/PromptBox";
import { ComputerTaskPanel, type ComputerTaskPhase } from "./ComputerTaskPanel";
import type { ComputerTaskPlan } from "../computer/ComputerTask";

type ChatWindowProps = {
  config: WorkBuddyConfig;
  messages: ChatMessage[];
  busy: boolean;
  focusToken: number;
  labels: Translations["chat"];
  computerLabels: Translations["computer"];
  computerTask: { plan: ComputerTaskPlan; phase: ComputerTaskPhase } | null;
  onSend: (message: string) => void;
  onRunQuickCommand: (command: QuickCommand) => void;
  onConfirmComputerTask: () => void;
  onCancelComputerTask: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
};

export function ChatWindow({
  config,
  messages,
  busy,
  focusToken,
  labels,
  computerLabels,
  computerTask,
  onSend,
  onRunQuickCommand,
  onConfirmComputerTask,
  onCancelComputerTask,
  onOpenSettings,
  onClose,
}: ChatWindowProps) {
  return (
    <section className="chat-panel" aria-label={labels.title}>
      {computerTask ? (
        <ComputerTaskPanel
          plan={computerTask.plan}
          phase={computerTask.phase}
          busy={busy}
          labels={computerLabels}
          onConfirm={onConfirmComputerTask}
          onCancel={onCancelComputerTask}
        />
      ) : null}

      <PromptBox
        disabled={busy}
        focusToken={focusToken}
        placeholder={labels.placeholder}
        sendTitle={labels.send}
        onSend={onSend}
      />
    </section>
  );
}
