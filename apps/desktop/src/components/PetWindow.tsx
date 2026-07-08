import { EyeOff, MessageCircle, MoreHorizontal, PanelBottomClose, Settings } from "lucide-react";
import { useRef, type CSSProperties, type PointerEvent } from "react";
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
  labels: Translations["pet"];
  petSize: number;
  toolbarHidden: boolean;
  onClickPet: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onHide: () => void;
  onRotatePet: (delta: number) => void;
  onToggleToolbar: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function PetWindow({
  pack,
  action,
  actionToken,
  rotationYaw,
  bubble,
  labels,
  petSize,
  toolbarHidden,
  onClickPet,
  onOpenChat,
  onOpenSettings,
  onHide,
  onRotatePet,
  onToggleToolbar,
  onDragStart,
  onDragEnd,
}: PetWindowProps) {
  const dragTimerRef = useRef<number | null>(null);
  const dragStartedRef = useRef(false);

  async function beginDrag() {
    dragStartedRef.current = true;
    onDragStart();
    const cleanupEdgeSnap = await armWindowEdgeSnap(petSize);
    await startWindowDrag().finally(() => {
      cleanupEdgeSnap();
      void snapWindowToScreenEdge(visibleStripForPet(petSize));
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

  return (
    <section
      className="pet-window"
      style={{ "--pet-size": `${petSize}px` } as CSSProperties}
      onMouseEnter={() => void peekWindowFromScreenEdge()}
    >
      {bubble ? <div className="pet-bubble">{bubble}</div> : null}

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
        onWheel={(event) => {
          event.preventDefault();
          onRotatePet(event.deltaY > 0 ? 0.35 : -0.35);
        }}
      >
        <PetRenderer
          pack={pack}
          action={action}
          actionToken={actionToken}
          rotationYaw={rotationYaw}
          autoRotate={action !== "walk" && action !== "run"}
        />
      </button>

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
