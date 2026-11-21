import { History, Maximize2, Minimize2, MessageSquarePlus } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { MessageList } from "../chat/MessageList";
import type { ChatConversation } from "../chat/ChatStore";
import type { ChatMessage, ProviderId, ProviderConfig, ReasoningEffort } from "../config/schema";
import type { Translations } from "../i18n";
import { supportsReasoningEffort } from "../providers/ProviderCapabilities";
import { startWindowDrag } from "../tauri/tauriClient";
import { PromptBox, type ChatDraft } from "../chat/PromptBox";

type ChatWindowProps = {
  busy: boolean;
  activeProvider: ProviderId;
  providerConfigs: Record<ProviderId, ProviderConfig>;
  conversations: ChatConversation[];
  activeConversationId: string;
  messages: ChatMessage[];
  expanded: boolean;
  focusToken: number;
  labels: Translations["chat"];
  providerLabels: Translations["providers"];
  onActivity: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onToggleExpanded: () => void;
  onProviderChange: (providerId: ProviderId) => void;
  onReasoningEffortChange: (effort: ReasoningEffort) => void;
  onSend: (message: ChatDraft) => void;
};

export function ChatWindow({
  busy,
  activeProvider,
  providerConfigs,
  conversations,
  activeConversationId,
  messages,
  expanded,
  focusToken,
  labels,
  providerLabels,
  onActivity,
  onNewConversation,
  onSelectConversation,
  onToggleExpanded,
  onProviderChange,
  onReasoningEffortChange,
  onSend,
}: ChatWindowProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const orderedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const availableProviders = (Object.keys(providerConfigs) as ProviderId[]).filter(
    (providerId) => providerConfigs[providerId].enabled || providerId === activeProvider,
  );
  const activeModel = providerConfigs[activeProvider];

  useEffect(() => {
    if (!expanded || !transcriptRef.current) return;
    transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [expanded, messages.length]);

  function handleHeaderMouseDown(event: MouseEvent<HTMLElement>) {
    if (!expanded || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, input, select, textarea, [data-no-drag]")) return;
    void startWindowDrag().catch(() => undefined);
  }

  function renderConversationOptions(sidebar = false) {
    return orderedConversations.map((conversation) => {
      const lastMessage = conversation.messages.at(-1);
      const preview = lastMessage?.content.trim().replace(/\s+/g, " ") || labels.emptyConversation;
      return (
        <button
          className={`chat-session-option${conversation.id === activeConversationId ? " active" : ""}${sidebar ? " sidebar-option" : ""}`}
          key={conversation.id}
          type="button"
          aria-pressed={conversation.id === activeConversationId}
          disabled={busy}
          onClick={() => {
            onSelectConversation(conversation.id);
            setHistoryOpen(false);
          }}
        >
          <strong>{conversation.title || labels.untitledConversation}</strong>
          <span>{preview}</span>
          <time>{new Date(conversation.updatedAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </button>
      );
    });
  }

  return (
    <section className={`chat-panel${expanded ? " expanded" : ""}`} aria-label={labels.title} onPointerDown={onActivity} onFocusCapture={onActivity}>
      <header className="chat-session-header" onMouseDown={handleHeaderMouseDown}>
        <div className="chat-session-current" title={activeConversation?.title || labels.untitledConversation}>
          <strong>{activeConversation?.title || labels.untitledConversation}</strong>
          <span>{labels.sessionHistory}</span>
        </div>
        <div className="chat-session-actions">
          <button
            type="button"
            className="chat-session-action"
            aria-label={labels.newConversation}
            title={labels.newConversation}
            disabled={busy}
            onClick={onNewConversation}
          >
            <MessageSquarePlus size={16} />
          </button>
          <button
            type="button"
            className="chat-session-action"
            aria-label={expanded ? labels.collapseChat : labels.expandChat}
            title={expanded ? labels.collapseChat : labels.expandChat}
            aria-pressed={expanded}
            onClick={onToggleExpanded}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          {!expanded ? (
            <button
              type="button"
              className={`chat-session-action${historyOpen ? " active" : ""}`}
              aria-label={labels.sessionHistory}
              aria-expanded={historyOpen}
              title={labels.sessionHistory}
              onClick={() => setHistoryOpen((open) => !open)}
            >
              <History size={16} />
            </button>
          ) : null}
        </div>
        {historyOpen ? (
          <div className="chat-session-menu" aria-label={labels.sessionHistory}>
            <h3>{labels.sessionHistory}</h3>
            {renderConversationOptions()}
          </div>
        ) : null}
      </header>
      {expanded ? (
        <div className="chat-expanded-body">
          <aside className="chat-history-sidebar" aria-label={labels.sessionHistory}>
            <div className="chat-history-sidebar-heading">
              <strong>{labels.sessionHistory}</strong>
              <span>{conversations.length}</span>
            </div>
            <div className="chat-history-sidebar-list">{renderConversationOptions(true)}</div>
          </aside>
          <div className="chat-transcript" aria-label={activeConversation?.title || labels.title} ref={transcriptRef}>
            <MessageList
              messages={messages}
              labels={labels}
              onCopyAssistant={(message) => navigator.clipboard.writeText(message.content)}
              copyTitle={labels.copyAnswer}
              copiedTitle={labels.copied}
            />
          </div>
        </div>
      ) : null}
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
      <div className="chat-model-controls">
        <label className="chat-model-picker" title={providerLabels.activeProvider}>
          <span>{providerLabels.model}</span>
          <select value={activeProvider} disabled={busy} onChange={(event) => onProviderChange(event.target.value as ProviderId)}>
            {availableProviders.map((providerId) => {
              const provider = providerConfigs[providerId];
              return (
                <option key={providerId} value={providerId}>
                  {provider.displayName} · {provider.modelId}
                </option>
              );
            })}
          </select>
        </label>
        {activeProvider === "openai" && supportsReasoningEffort(activeModel.modelId) ? (
          <label className="chat-reasoning-picker" title={providerLabels.reasoningEffort}>
            <span>{providerLabels.reasoningEffort}</span>
            <select
              value={activeModel.reasoningEffort ?? "medium"}
              disabled={busy}
              onChange={(event) => onReasoningEffortChange(event.target.value as ReasoningEffort)}
            >
              <option value="none">{providerLabels.reasoningNone}</option>
              <option value="minimal">{providerLabels.reasoningMinimal}</option>
              <option value="low">{providerLabels.reasoningLow}</option>
              <option value="medium">{providerLabels.reasoningMedium}</option>
              <option value="high">{providerLabels.reasoningHigh}</option>
              <option value="xhigh">{providerLabels.reasoningExtraHigh}</option>
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}
