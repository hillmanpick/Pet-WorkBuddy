import { KeyboardEvent, useState } from "react";
import { Keyboard } from "lucide-react";
import { normalizeShortcut, shortcutFromKeyboardEvent } from "./ShortcutManager";

type ShortcutRecorderProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    const next = normalizeShortcut(shortcutFromKeyboardEvent(event.nativeEvent));
    if (next) {
      onChange(next);
      setRecording(false);
    }
  }

  return (
    <button
      className={recording ? "shortcut-recorder recording" : "shortcut-recorder"}
      type="button"
      onClick={() => setRecording(true)}
      onKeyDown={handleKeyDown}
    >
      <Keyboard size={15} />
      <span>{recording ? "Press keys" : value}</span>
    </button>
  );
}

