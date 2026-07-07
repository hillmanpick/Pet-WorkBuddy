import { FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";

type PromptBoxProps = {
  disabled?: boolean;
  focusToken: number;
  onSend: (message: string) => void;
};

export function PromptBox({ disabled, focusToken, onSend }: PromptBoxProps) {
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
        placeholder="Ask WorkBuddy..."
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            submit(event);
          }
        }}
      />
      <button type="submit" disabled={disabled || !value.trim()} title="Send">
        <Send size={18} />
      </button>
    </form>
  );
}

