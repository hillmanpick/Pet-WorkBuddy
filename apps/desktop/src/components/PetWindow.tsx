import { Check, EyeOff, MessageCircle, MoreHorizontal, PanelBottomClose, Send, Settings, ShieldCheck, X } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { ComputerTaskPhase } from "./ComputerTaskPanel";
import type { ComputerTaskPlan } from "../computer/ComputerTask";
import type { Translations } from "../i18n";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { PetRenderer } from "../pet/PetRenderer";
import {
  armWindowEdgeSnap,
  peekWindowFromScreenEdge,
  snapWindowToScreenEdge,
  startWindowDrag,
  visibleStripForPet,
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
  onDragStart,
  onDragEnd,
}: PetWindowProps) {
  const dragTimerRef = useRef<number | null>(null);
  const dragStartedRef = useRef(false);
  const rotatePointerIdRef = useRef<number | null>(null);
  const rotateLastPointRef = useRef({ x: 0, y: 0 });
  const [edgeTucked, setEdgeTucked] = useState(false);

  async function beginDrag() {
    dragStartedRef.current = true;
    setEdgeTucked(false);
    onDragStart();
    const cleanupEdgeSnap = await armWindowEdgeSnap(petSize);
    await startWindowDrag().finally(() => {
      cleanupEdgeSnap();
      void snapWindowToScreenEdge(visibleStripForPet(petSize), petSize).then((edge) => {
        setEdgeTucked(Boolean(edge));
      });
      onDragEnd();
    });
  }

  function clearDragTimer() {
    if (dragTimerRef.current) {
      window.clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    dragStartedRef.current = false;
    clearDragTimer();
    dragTimerRef.current = window.setTimeout(() => {
      dragTimerRef.current = null;
      void beginDrag();
    }, 180);
  }

  function handlePointerUp() {
    const wasDragging = dragStartedRef.current;
    clearDragTimer();
    dragStartedRef.current = false;
    if (!wasDragging) {
      onClickPet();
    }
  }

  function handleRotatePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    clearDragTimer();
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
    await peekWindowFromScreenEdge(petSize);
    setEdgeTucked(false);
  }

  return (
    <section
      className={`pet-window${edgeTucked ? " edge-tucked" : ""}`}
      style={{ "--pet-size": `${petSize}px`, "--pet-accent": petAccentColor(pack) } as CSSProperties}
      onMouseEnter={() => void handleMouseEnter()}
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
          title={labels.drag}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            clearDragTimer();
            dragStartedRef.current = false;
          }}
        >
          <PetRenderer
            pack={pack}
            action={action}
            actionToken={actionToken}
            rotationYaw={rotationYaw}
            autoRotate={false}
          />
        </button>
        <button
          className="pet-rotate-handle"
          type="button"
          title={labels.rotate}
          aria-label={labels.rotate}
          onPointerDown={handleRotatePointerDown}
          onPointerMove={handleRotatePointerMove}
          onPointerUp={handleRotatePointerEnd}
          onPointerCancel={handleRotatePointerEnd}
        />
      </div>

      {toolbarHidden ? (
        <button className="pet-toolbar-reveal" type="button" title={labels.showToolbar} onClick={onToggleToolbar}>
          <MoreHorizontal size={18} />
        </button>
      ) : (
        <nav className="pet-toolbar">
          <button type="button" title={labels.openChat} onClick={onOpenChat}>
            <MessageCircle size={17} />
          </button>
          <button type="button" title={labels.openSettings} onClick={onOpenSettings}>
            <Settings size={17} />
          </button>
          <button type="button" title={labels.hideToolbar} onClick={onToggleToolbar}>
            <PanelBottomClose size={17} />
          </button>
          <button type="button" title={labels.hidePet} onClick={onHide}>
            <EyeOff size={17} />
          </button>
        </nav>
      )}

      {pack ? <span className="pet-name">{pack.name}</span> : null}
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
        <button type="button" title={labels.cancel} disabled={busy} onClick={onCancel}>
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
