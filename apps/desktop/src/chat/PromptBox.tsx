import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { FileText, Image, Paperclip, Send, X } from "lucide-react";
import { acceptedAttachmentTypes, attachmentSizeLabel, readChatAttachments } from "./AttachmentProcessor";
import type { ChatAttachment } from "../config/schema";

export type ChatDraft = {
  content: string;
  attachments: ChatAttachment[];
};

type PromptBoxProps = {
  disabled?: boolean;
  focusToken: number;
  placeholder: string;
  sendTitle: string;
  attachTitle: string;
  removeAttachmentTitle: string;
  attachmentWarningTitle: string;
  onActivity: () => void;
  onSend: (message: ChatDraft) => void;
};

export function PromptBox({
  disabled,
  focusToken,
  placeholder,
  sendTitle,
  attachTitle,
  removeAttachmentTitle,
  attachmentWarningTitle,
  onActivity,
  onSend,
}: PromptBoxProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    function preventFileNavigation(event: globalThis.DragEvent) {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
    }

    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    onActivity();
    const text = value.trim();
    if ((!text && !attachments.length) || disabled || reading) return;
    setValue("");
    setAttachments([]);
    setWarnings([]);
    onSend({ content: text || "请识别我上传的附件。", attachments });
  }

  async function addFiles(files: FileList | File[]) {
    if (!files?.length || disabled) return;

    onActivity();
    setReading(true);
    try {
      const result = await readChatAttachments(files);
      setAttachments((current) => [...current, ...result.attachments].slice(0, 4));
      setWarnings(result.warnings);
    } finally {
      setReading(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    await addFiles(files ?? []);
  }

  function hasFileTransfer(dataTransfer: DataTransfer): boolean {
    return Array.from(dataTransfer.types).includes("Files");
  }

  function filesFromItems(items: DataTransferItemList): File[] {
    return Array.from(items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
  }

  function handleDragEnter(event: DragEvent<HTMLFormElement>) {
    if (!hasFileTransfer(event.dataTransfer) || disabled) return;
    event.preventDefault();
    onActivity();
    dragDepthRef.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLFormElement>) {
    if (!hasFileTransfer(event.dataTransfer) || disabled) return;
    event.preventDefault();
    onActivity();
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLFormElement>) {
    if (!hasFileTransfer(event.dataTransfer)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDragActive(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    if (!hasFileTransfer(event.dataTransfer) || disabled) return;
    event.preventDefault();
    onActivity();
    dragDepthRef.current = 0;
    setDragActive(false);

    const files = event.dataTransfer.files.length
      ? Array.from(event.dataTransfer.files)
      : filesFromItems(event.dataTransfer.items);
    void addFiles(files);
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const clipboard = event.clipboardData;
    const files = clipboard.files.length ? Array.from(clipboard.files) : filesFromItems(clipboard.items);
    if (!files.length || disabled) return;

    event.preventDefault();
    onActivity();
    void addFiles(files);
  }

  function removeAttachment(id: string) {
    onActivity();
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  return (
    <form
      className={`prompt-box${dragActive ? " dragging" : ""}`}
      onSubmit={submit}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {attachments.length || warnings.length ? (
        <div className="attachment-tray">
          {attachments.map((attachment) => (
            <span className={`attachment-chip ${attachment.kind}`} key={attachment.id} title={attachment.name}>
              {attachment.kind === "image" ? <Image size={13} /> : <FileText size={13} />}
              <span>{attachment.name}</span>
              <small>{attachmentSizeLabel(attachment.size)}</small>
              <button
                type="button"
                title={removeAttachmentTitle}
                disabled={disabled}
                onClick={() => removeAttachment(attachment.id)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {warnings.length ? (
            <span className="attachment-warning" title={warnings.join("\n")}>
              {attachmentWarningTitle}
            </span>
          ) : null}
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept={acceptedAttachmentTypes()}
        onChange={handleFileChange}
      />
      <button
        className="attachment-button"
        type="button"
        disabled={disabled || reading}
        title={attachTitle}
        onClick={() => {
          onActivity();
          fileInputRef.current?.click();
        }}
      >
        <Paperclip size={18} />
      </button>
      <textarea
        ref={inputRef}
        value={value}
        rows={2}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          onActivity();
          setValue(event.target.value);
        }}
        onPaste={handlePaste}
        onKeyDown={(event) => {
          onActivity();
          if (event.key === "Enter" && !event.shiftKey) {
            submit(event);
          }
        }}
      />
      <button type="submit" disabled={disabled || reading || (!value.trim() && !attachments.length)} title={sendTitle}>
        <Send size={18} />
      </button>
    </form>
  );
}
