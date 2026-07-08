import type { ChatAttachment } from "../config/schema";

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 80_000;
const MAX_IMAGE_SIDE = 1600;

const textExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "xml",
  "html",
  "htm",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "rs",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "rb",
  "swift",
  "kt",
  "sql",
  "yaml",
  "yml",
  "toml",
  "ini",
  "log",
]);

export type AttachmentReadResult = {
  attachments: ChatAttachment[];
  warnings: string[];
};

export function acceptedAttachmentTypes(): string {
  return [
    "image/*",
    ".txt",
    ".md",
    ".csv",
    ".tsv",
    ".json",
    ".xml",
    ".html",
    ".css",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".rs",
    ".go",
    ".java",
    ".sql",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".log",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
  ].join(",");
}

export async function readChatAttachments(files: FileList | File[]): Promise<AttachmentReadResult> {
  const selectedFiles = Array.from(files).slice(0, MAX_ATTACHMENTS);
  const warnings: string[] = [];
  if (files.length > MAX_ATTACHMENTS) {
    warnings.push(`Only the first ${MAX_ATTACHMENTS} attachments were added.`);
  }

  const attachments: ChatAttachment[] = [];
  for (const file of selectedFiles) {
    try {
      attachments.push(await readChatAttachment(file));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`${file.name}: ${message}`);
    }
  }

  return { attachments, warnings };
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isTextFile(file: File): boolean {
  return file.type.startsWith("text/") || textExtensions.has(extensionOf(file.name));
}

async function readChatAttachment(file: File): Promise<ChatAttachment> {
  if (file.type.startsWith("image/")) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("image is larger than 12 MB");
    }
    return readImageAttachment(file);
  }

  if (isTextFile(file)) {
    if (file.size > MAX_TEXT_BYTES) {
      throw new Error("text file is larger than 2 MB");
    }
    const text = await file.text();
    const truncated = text.length > MAX_TEXT_CHARS;
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type || "text/plain",
      size: file.size,
      kind: "text",
      text: truncated ? text.slice(0, MAX_TEXT_CHARS) : text,
      truncated,
    };
  }

  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind: "file",
  };
}

async function readImageAttachment(file: File): Promise<ChatAttachment> {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (file.type === "image/gif" || file.type === "image/webp") {
    return {
      id: crypto.randomUUID(),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      kind: "image",
      dataUrl: rawDataUrl,
    };
  }

  const image = await loadImage(rawDataUrl);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("cannot create image canvas");
  }
  context.drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" && file.size < 1_200_000 ? "image/png" : "image/jpeg";
  const dataUrl = canvas.toDataURL(outputType, 0.86);
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: outputType,
    size: estimateDataUrlBytes(dataUrl),
    kind: "image",
    dataUrl,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("failed to read file"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("failed to decode image"));
    image.src = dataUrl;
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  return Math.round((base64.length * 3) / 4);
}

export function attachmentSizeLabel(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
