import type { ReactNode } from "react";

type MarkdownTextProps = {
  content: string;
};

type MarkdownBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "code"; text: string };

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let codeLines: string[] = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    blocks.push({ type: list.type, items: list.items });
    list = null;
  }

  function flushCode() {
    if (!codeLines.length) return;
    blocks.push({ type: "code", text: codeLines.join("\n").trimEnd() });
    codeLines = [];
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        flushCode();
      } else {
        flushParagraph();
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const markdownLine = trimmed.replace(/^>\s?/, "");
    const heading = markdownLine.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: heading[2].trim() });
      return;
    }

    const unordered = markdownLine.match(/^[-*+]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1].trim());
      return;
    }

    const ordered = markdownLine.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1].trim());
      return;
    }

    flushList();
    paragraph.push(markdownLine);
  });

  if (inCodeBlock) flushCode();
  flushParagraph();
  flushList();

  return blocks.length ? blocks : [{ type: "paragraph", text: content }];
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/<[^>]+>/g, "");
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern = /(`[^`]+`|\*\*[^*]+?\*\*|__[^_]+?__|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*[^*\n]+?\*|_[^_\n]+?_)/g;
  let lastIndex = 0;
  let nodeIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `inline-${nodeIndex}`;
    nodeIndex += 1;

    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("![") && token.includes("](")) {
      const label = token.match(/^!\[([^\]]*)\]\([^)]+\)$/)?.[1] ?? "";
      nodes.push(label ? <span key={key}>{label}</span> : null);
    } else if (token.startsWith("[") && token.includes("](")) {
      const label = token.match(/^\[([^\]]+)\]\([^)]+\)$/)?.[1] ?? token;
      nodes.push(
        <span className="message-markdown-link" key={key}>
          {label}
        </span>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function plainTextFromMarkdown(markdown: string): string {
  return parseMarkdownBlocks(markdown)
    .map((block) => {
      if (block.type === "heading" || block.type === "paragraph" || block.type === "code") {
        return stripInlineMarkdown(block.text);
      }
      return block.items.map(stripInlineMarkdown).join(" ");
    })
    .join(" ")
    .replace(/\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function bubbleTextFromMarkdown(markdown: string, maxLength = 118): string {
  const text = plainTextFromMarkdown(markdown);
  if (text.length <= maxLength) return text;

  const punctuation = new Set([".", "!", "?", "\u3002", "\uff01", "\uff1f"]);
  const limit = Math.max(48, maxLength);
  let sentenceCut = -1;

  for (let index = 0; index < Math.min(text.length, limit); index += 1) {
    if (index >= 32 && punctuation.has(text[index])) {
      sentenceCut = index + 1;
      break;
    }
  }

  if (sentenceCut > 0) {
    return text.slice(0, sentenceCut).trim();
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

export function MarkdownText({ content }: MarkdownTextProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className="message-markdown">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <p className="message-markdown-heading" key={`${block.type}-${index}`}>
              <strong>{renderInlineMarkdown(block.text)}</strong>
            </p>
          );
        }

        if (block.type === "paragraph") {
          return <p key={`${block.type}-${index}`}>{renderInlineMarkdown(block.text)}</p>;
        }

        if (block.type === "code") {
          return (
            <pre key={`${block.type}-${index}`}>
              <code>{block.text}</code>
            </pre>
          );
        }

        const ListTag = block.type;
        return (
          <ListTag key={`${block.type}-${index}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}
