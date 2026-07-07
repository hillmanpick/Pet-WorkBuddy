import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

type PromptBoxProps = {
  disabled?: boolean;
  focusToken: number;
  placeholder: string;
  sendTitle: string;
  onSend: (message: string) => void;
};

export function PromptBox({ disabled, focusToken, placeholder, sendTitle, onSend }: PromptBoxProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  }

  return (
    <form className="prompt-box" onSubmit={submit}>
      <textarea
        ref={inputRef}
        value={value}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            submit(event);
          }
        }}
      />
      <button type="submit" disabled={disabled || !value.trim()} title={sendTitle}>
        <Send size={18} />
      </button>
    </form>
  );
}
