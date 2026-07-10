import { Check, EyeOff, MessageCircle, MoreHorizontal, PanelBottomClose, Send, Settings, ShieldCheck, X } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { ComputerTaskPhase } from "./ComputerTaskPanel";
import type { ComputerTaskPlan } from "../computer/ComputerTask";
import type { Translations } from "../i18n";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { PetRenderer } from "../pet/PetRenderer";
import {
  dragWindowWithPointer,
  peekWindowFromScreenEdge,
  snapWindowToScreenEdge,
  setWindowMousePassthrough,
  visibleStripForPet,
  writeAppLog,
  type ScreenEdge,
} from "../tauri/tauriClient";

type PetWindowProps = {
  pack: LoadedPetPack | null;
  action: string;
  actionToken: number;
  rotationYaw: number;
  bubble?: string;
  computerTask: { plan: ComputerTaskPlan; phase: ComputerTaskPhase } | null;
  computerLabels: Translations["computer"];
  labels: Translations["pet"];
  petSize: number;
  petDisplayName?: string;
  busy: boolean;
  toolbarHidden: boolean;
  onClickPet: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onHide: () => void;
  onConfirmComputerTask: () => void;
  onCancelComputerTask: () => void;
  onRotatePet: (delta: number) => void;
  onToggleToolbar: () => void;
  onToolbarActivity: () => void;
  onTuckedEdgeChange: (edge: ScreenEdge | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

function petAccentColor(pack: LoadedPetPack | null): string {
  switch (pack?.id) {
    case "kenney-cat":
      return "#f59e3d";
    case "kenney-dog":
      return "#9a6a3d";
    case "kenney-bunny":
      return "#f3a5bd";
    case "kenney-panda":
      return "#343a40";
    case "kenney-fox":
      return "#e86f37";
    case "kenney-penguin":
      return "#334155";
    case "kenney-koala":
      return "#9aa4ad";
    case "kenney-chick":
      return "#f5c84c";
    default:
      return "#6f9b7a";
  }
}

export function PetWindow({
  pack,
  action,
  actionToken,
  rotationYaw,
  bubble,
  computerTask,
  computerLabels,
  labels,
  petSize,
  petDisplayName,
  busy,
  toolbarHidden,
  onClickPet,
  onOpenChat,
  onOpenSettings,
  onHide,
  onConfirmComputerTask,
  onCancelComputerTask,
  onRotatePet,
  onToggleToolbar,
  onToolbarActivity,
  onTuckedEdgeChange,
  onDragStart,
  onDragEnd,
}: PetWindowProps) {
  const dragPointerIdRef = useRef<number | null>(null);
  const dragInFlightRef = useRef(false);
  const dragStartedRef = useRef(false);
  const rotatePointerIdRef = useRef<number | null>(null);
  const rotateLastPointRef = useRef({ x: 0, y: 0 });
  const [tuckedEdge, setTuckedEdge] = useState<ScreenEdge | null>(null);
  const tuckRotationYaw =
    tuckedEdge === "left" ? Math.PI / 4 : tuckedEdge === "right" ? -Math.PI / 4 : rotationYaw;

  function updateTuckedEdge(edge: ScreenEdge | null) {
    setTuckedEdge(edge);
    onTuckedEdgeChange(edge);
  }

  function releaseDragPointer(event: PointerEvent<HTMLButtonElement>) {
    if (dragPointerIdRef.current !== event.pointerId) return;
    dragPointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function trackDrag() {
    if (dragInFlightRef.current) return;
    dragInFlightRef.current = true;
    dragStartedRef.current = false;
    const startEdge = tuckedEdge;

    writeAppLog("PetWindow:trackDrag:start", { tuckedEdge: startEdge });
    await setWindowMousePassthrough(false).catch(() => undefined);

    const result = await dragWindowWithPointer(petSize, {
      activationDistance: 2,
      startEdge,
      onActivated: () => {
        if (dragStartedRef.current) return;
        dragStartedRef.current = true;
        writeAppLog("PetWindow:trackDrag:activated", { startEdge });
        updateTuckedEdge(null);
        onDragStart();
      },
    }).catch(() => ({ activated: false, edge: null }));

    writeAppLog("PetWindow:trackDrag:result", result);
    if (result.activated) {
      updateTuckedEdge(result.edge);
      onDragEnd();
    } else {
      if (startEdge) {
        const edge = await peekWindowFromScreenEdge(petSize).catch(() => startEdge);
        updateTuckedEdge(edge ?? startEdge);
      }
      onClickPet();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    if (dragInFlightRef.current) return;
    event.preventDefault();
    onToolbarActivity();
    dragPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    void trackDrag().finally(() => {
      dragInFlightRef.current = false;
      dragStartedRef.current = false;
      dragPointerIdRef.current = null;
    });
  }

  function handleRotatePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    onToolbarActivity();
    event.preventDefault();
    event.stopPropagation();
    dragStartedRef.current = false;
    rotatePointerIdRef.current = event.pointerId;
    rotateLastPointRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleRotatePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (rotatePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const previous = rotateLastPointRef.current;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    rotateLastPointRef.current = { x: event.clientX, y: event.clientY };
    onRotatePet((dx - dy) * 0.022);
  }

  function handleRotatePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (rotatePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    rotatePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function handleMouseEnter() {
    if (dragInFlightRef.current) return;
    const edge = await peekWindowFromScreenEdge(petSize);
    if (edge && edge !== tuckedEdge) {
      updateTuckedEdge(edge);
    }
  }

  async function handleMouseLeave() {
    if (dragInFlightRef.current || !tuckedEdge) return;
    const edge = await snapWindowToScreenEdge(visibleStripForPet(petSize), petSize, true, tuckedEdge);
    updateTuckedEdge(edge ?? tuckedEdge);
  }

  return (
    <section
      className={`pet-window${tuckedEdge ? ` edge-tucked edge-${tuckedEdge}` : ""}`}
      style={{ "--pet-size": `${petSize}px`, "--pet-accent": petAccentColor(pack) } as CSSProperties}
      onMouseEnter={() => void handleMouseEnter()}
      onMouseLeave={() => void handleMouseLeave()}
    >
      {computerTask ? (
        <ComputerTaskBubble
          task={computerTask}
          busy={busy}
          labels={computerLabels}
          onConfirm={onConfirmComputerTask}
          onCancel={onCancelComputerTask}
        />
      ) : bubble ? (
        <div className="pet-bubble">{bubble}</div>
      ) : null}

      <div className="pet-stage-shell">
        <button
          className="pet-stage"
          type="button"
          aria-label={labels.drag}
          onPointerDown={handlePointerDown}
          onPointerUp={releaseDragPointer}
          onPointerCancel={releaseDragPointer}
        >
          <PetRenderer
            pack={pack}
            action={action}
            actionToken={actionToken}
            rotationYaw={tuckRotationYaw}
            autoRotate={false}
            followPointer={!tuckedEdge}
          />
        </button>
        <button
          className="pet-rotate-handle"
          type="button"
          aria-label={labels.rotate}
          onPointerDown={handleRotatePointerDown}
          onPointerMove={handleRotatePointerMove}
          onPointerUp={handleRotatePointerEnd}
          onPointerCancel={handleRotatePointerEnd}
        />
      </div>

      {toolbarHidden ? (
        <button
          className="pet-toolbar-reveal"
          type="button"
          aria-label={labels.showToolbar}
          onClick={() => {
            onToolbarActivity();
            onToggleToolbar();
          }}
        >
          <MoreHorizontal size={18} />
        </button>
      ) : (
        <nav className="pet-toolbar">
          <button
            type="button"
            aria-label={labels.openChat}
            onClick={() => {
              onToolbarActivity();
              onOpenChat();
            }}
          >
            <MessageCircle size={17} />
          </button>
          <button
            type="button"
            aria-label={labels.openSettings}
            onClick={() => {
              onToolbarActivity();
              onOpenSettings();
            }}
          >
            <Settings size={17} />
          </button>
          <button
            type="button"
            aria-label={labels.hideToolbar}
            onClick={() => {
              onToolbarActivity();
              onToggleToolbar();
            }}
          >
            <PanelBottomClose size={17} />
          </button>
          <button
            type="button"
            aria-label={labels.hidePet}
            onClick={() => {
              onToolbarActivity();
              onHide();
            }}
          >
            <EyeOff size={17} />
          </button>
        </nav>
      )}

      {petDisplayName || pack?.name ? <span className="pet-name">{petDisplayName || pack?.name}</span> : null}
    </section>
  );
}

type ComputerTaskBubbleProps = {
  task: { plan: ComputerTaskPlan; phase: ComputerTaskPhase };
  busy: boolean;
  labels: Translations["computer"];
  onConfirm: () => void;
  onCancel: () => void;
};

function ComputerTaskBubble({ task, busy, labels, onConfirm, onCancel }: ComputerTaskBubbleProps) {
  const isFinal = task.phase === "final";
  const title = isFinal ? task.plan.finalTitle ?? labels.finalTitle : task.plan.title;
  const summary = isFinal ? task.plan.finalSummary ?? labels.finalSummary : task.plan.summary;
  const steps = isFinal ? [] : task.plan.steps.slice(0, 3);

  return (
    <div className="pet-bubble pet-task-bubble" role="dialog" aria-label={labels.title}>
      <header>
        <span>
          <ShieldCheck size={14} />
          <strong>{title}</strong>
        </span>
        <button type="button" aria-label={labels.cancel} disabled={busy} onClick={onCancel}>
          <X size={14} />
        </button>
      </header>
      <p>{summary}</p>
      {steps.length ? (
        <ul>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      ) : null}
      <footer>
        <button type="button" disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </button>
        <button className="primary" type="button" disabled={busy} onClick={onConfirm}>
          {isFinal ? <Send size={14} /> : <Check size={14} />}
          {busy ? labels.running : isFinal ? labels.send : labels.run}
        </button>
      </footer>
    </div>
  );
}
