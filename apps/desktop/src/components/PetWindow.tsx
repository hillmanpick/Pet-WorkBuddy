import { EyeOff, MessageCircle, Move, Settings } from "lucide-react";
import type { LoadedPetPack } from "../pet/PetPackLoader";
import { PetRenderer } from "../pet/PetRenderer";
import { startWindowDrag } from "../tauri/tauriClient";

type PetWindowProps = {
  pack: LoadedPetPack | null;
  action: string;
  bubble?: string;
  onClickPet: () => void;
  onOpenChat: () => void;
  onOpenSettings: () => void;
  onHide: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function PetWindow({
  pack,
  action,
  bubble,
  onClickPet,
  onOpenChat,
  onOpenSettings,
  onHide,
  onDragStart,
  onDragEnd,
}: PetWindowProps) {
  return (
    <section className="pet-window">
      <div
        className="pet-drag-zone"
        title="Drag WorkBuddy"
        onPointerDown={() => {
          onDragStart();
          void startWindowDrag().finally(onDragEnd);
        }}
      >
        <Move size={14} />
      </div>

      {bubble ? <div className="pet-bubble">{bubble}</div> : null}

      <button className="pet-stage" type="button" onClick={onClickPet}>
        <PetRenderer pack={pack} action={action} />
      </button>

      <nav className="pet-toolbar">
        <button type="button" title="Open chat" onClick={onOpenChat}>
          <MessageCircle size={17} />
        </button>
        <button type="button" title="Settings" onClick={onOpenSettings}>
          <Settings size={17} />
        </button>
        <button type="button" title="Hide pet" onClick={onHide}>
          <EyeOff size={17} />
        </button>
      </nav>

      {pack ? <span className="pet-name">{pack.name}</span> : null}
    </section>
  );
}

