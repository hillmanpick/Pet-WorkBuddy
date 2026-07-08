import type { Translations } from "../i18n";
import { PromptBox } from "../chat/PromptBox";

type ChatWindowProps = {
  busy: boolean;
  focusToken: number;
  labels: Translations["chat"];
  onSend: (message: string) => void;
};

export function ChatWindow({
  busy,
  focusToken,
  labels,
  onSend,
}: ChatWindowProps) {
  return (
    <section className="chat-panel" aria-label={labels.title}>
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
