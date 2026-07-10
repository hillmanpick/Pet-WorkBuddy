import type { Translations } from "../i18n";
import { PromptBox, type ChatDraft } from "../chat/PromptBox";

type ChatWindowProps = {
  busy: boolean;
  focusToken: number;
  labels: Translations["chat"];
  onActivity: () => void;
  onSend: (message: ChatDraft) => void;
};

export function ChatWindow({
  busy,
  focusToken,
  labels,
  onActivity,
  onSend,
}: ChatWindowProps) {
  return (
    <section className="chat-panel" aria-label={labels.title} onPointerDown={onActivity} onFocusCapture={onActivity}>
      <PromptBox
        disabled={busy}
        focusToken={focusToken}
        placeholder={labels.placeholder}
        sendTitle={labels.send}
        attachTitle={labels.attach}
        removeAttachmentTitle={labels.removeAttachment}
        attachmentWarningTitle={labels.attachmentWarning}
        onActivity={onActivity}
        onSend={onSend}
      />
    </section>
  );
}
