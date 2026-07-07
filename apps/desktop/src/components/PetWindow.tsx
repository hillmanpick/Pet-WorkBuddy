import { EyeOff, MessageCircle, MoreHorizontal, PanelBottomClose, Settings } from "lucide-react";
import type { CSSProperties } from "react";
import type { Translations } from "../i18n";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { PetRenderer } from "../pet/PetRenderer";
import { armWindowEdgeSnap, peekWindowFromScreenEdge, startWindowDrag } from "../tauri/tauriClient";

type PetWindowProps = {
  pack: LoadedPetPack | null;
  action: string;
  bubble?: string;
  labels: Translations["pet"];
  petSize: number;
  toolbarHidden: boolean;
  onClickPet: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onHide: () => void;
  onToggleToolbar: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function PetWindow({
  pack,
  action,
  bubble,
  labels,
  petSize,
  toolbarHidden,
  onClickPet,
  onOpenChat,
  onOpenSettings,
  onHide,
  onToggleToolbar,
  onDragStart,
  onDragEnd,
}: PetWindowProps) {
  async function beginDrag() {
    onDragStart();
    await armWindowEdgeSnap(petSize);
    await startWindowDrag().finally(onDragEnd);
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
        onClick={onClickPet}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          void beginDrag();
        }}
      >
        <PetRenderer pack={pack} action={action} />
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
