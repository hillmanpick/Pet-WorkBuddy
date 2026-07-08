import type { UiLanguage } from "../config/schema";
import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

export type ComputerAction =
  | { type: "open_app"; app: string }
  | { type: "open_folder"; folder: string }
  | { type: "organize_folder"; folder: string }
  | { type: "open_url"; url: string }
  | { type: "set_clipboard"; text: string }
  | { type: "paste_text"; text: string }
  | { type: "hotkey"; keys: string[] }
  | { type: "key"; key: string }
  | { type: "wait"; ms: number };

export type TaskSensitivity = "normal" | "sensitive";

export type LocalTask = {
  type: "reminder";
  message: string;
  delayMs: number;
};

export type ComputerTaskPlan = {
  id: string;
  title: string;
  summary: string;
  sensitivity: TaskSensitivity;
  steps: string[];
  actions: ComputerAction[];
  localTask?: LocalTask;
  finalTitle?: string;
  finalSummary?: string;
  finalSensitivity?: TaskSensitivity;
  finalActions?: ComputerAction[];
};

type ActionResult = {
  index: number;
  ok: boolean;
  message: string;
};

type AppAlias = {
  keys: string[];
  app: string;
  zh: string;
  en: string;
};

type FolderAlias = {
  keys: string[];
  folder: string;
  zh: string;
  en: string;
};

type ParsedWechatMessage = {
  contact: string;
  message: string;
};

const appAliases: AppAlias[] = [
  { keys: ["微信", "wechat", "weixin", "wx"], app: "wechat", zh: "微信", en: "WeChat" },
  { keys: ["资源管理器", "文件管理器", "explorer", "file explorer", "files"], app: "explorer", zh: "资源管理器", en: "File Explorer" },
  { keys: ["记事本", "notepad"], app: "notepad", zh: "记事本", en: "Notepad" },
  { keys: ["计算器", "calculator", "calc"], app: "calculator", zh: "计算器", en: "Calculator" },
  { keys: ["画图", "paint", "mspaint"], app: "paint", zh: "画图", en: "Paint" },
  { keys: ["系统设置", "windows 设置", "settings", "windows settings"], app: "settings", zh: "系统设置", en: "Windows Settings" },
  { keys: ["截图", "截屏", "snip", "screenshot", "snipping"], app: "screenshot", zh: "截图工具", en: "Screenshot tool" },
];

const folderAliases: FolderAlias[] = [
  { keys: ["桌面", "desktop"], folder: "desktop", zh: "桌面", en: "Desktop" },
  { keys: ["下载", "下载文件夹", "downloads", "download folder"], folder: "downloads", zh: "下载文件夹", en: "Downloads" },
  { keys: ["文档", "documents", "docs"], folder: "documents", zh: "文档", en: "Documents" },
  { keys: ["图片", "照片", "pictures", "photos"], folder: "pictures", zh: "图片", en: "Pictures" },
  { keys: ["音乐", "music"], folder: "music", zh: "音乐", en: "Music" },
  { keys: ["视频", "videos"], folder: "videos", zh: "视频", en: "Videos" },
  { keys: ["用户目录", "主目录", "home"], folder: "home", zh: "用户目录", en: "Home" },
];

export function createComputerTaskPlan(text: string, language: UiLanguage): ComputerTaskPlan | null {
  const prompt = text.trim();
  if (!prompt) return null;

  const reminder = parseReminder(prompt, language);
  if (reminder) return reminder;

  const wechatMessage = parseWechatMessage(prompt);
  if (wechatMessage) return createWechatMessagePlan(wechatMessage, language);

  const note = parseNote(prompt);
  if (note) return createNotePlan(note, language);

  const copyText = parseCopyText(prompt);
  if (copyText) return createCopyPlan(copyText, language);

  const pasteText = parsePasteText(prompt);
  if (pasteText) return createPastePlan(pasteText, language);

  const search = parseSearch(prompt);
  if (search) return createSearchPlan(search.query, search.engine, language);

  const url = parseOpenUrl(prompt);
  if (url) return createOpenUrlPlan(url, language);

  const organizeFolder = findOrganizeFolder(prompt);
  if (organizeFolder) return createOrganizeFolderPlan(organizeFolder, language);

  const folder = findOpenFolder(prompt);
  if (folder) return createOpenFolderPlan(folder, language);

  const app = findOpenApp(prompt);
  if (app) return createOpenAppPlan(app, language);

  return null;
}

export async function executeComputerActions(actions: ComputerAction[]): Promise<ActionResult[]> {
  if (!isTauriRuntime()) {
    throw new Error("Computer control is only available in the desktop app.");
  }

  return invokeCommand<ActionResult[]>("execute_computer_actions", { actions });
}

function createOpenAppPlan(app: AppAlias, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  const appName = zh ? app.zh : app.en;
  return {
    id: crypto.randomUUID(),
    title: zh ? `打开${appName}` : `Open ${appName}`,
    summary: zh ? `启动 ${appName}` : `Launch ${appName}`,
    sensitivity: "normal",
    steps: [zh ? `启动 ${appName}` : `Launch ${appName}`],
    actions: [{ type: "open_app", app: app.app }],
  };
}

function createOpenFolderPlan(folder: FolderAlias, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  const folderName = zh ? folder.zh : folder.en;
  return {
    id: crypto.randomUUID(),
    title: zh ? `打开${folderName}` : `Open ${folderName}`,
    summary: zh ? `打开 ${folderName}` : `Open ${folderName}`,
    sensitivity: "normal",
    steps: [zh ? "用资源管理器打开文件夹" : "Open the folder in File Explorer"],
    actions: [{ type: "open_folder", folder: folder.folder }],
  };
}

function createOrganizeFolderPlan(folder: FolderAlias, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  const folderName = zh ? folder.zh : folder.en;
  return {
    id: crypto.randomUUID(),
    title: zh ? `整理${folderName}` : `Organize ${folderName}`,
    summary: zh
      ? `把 ${folderName} 第一层文件按类型移动到 WorkBuddy Organized`
      : `Move top-level files in ${folderName} into WorkBuddy Organized by type`,
    sensitivity: "sensitive",
    steps: zh
      ? [
          `扫描 ${folderName} 第一层文件`,
          "创建 WorkBuddy Organized 分类文件夹",
          "按文件类型移动文件，重名文件自动加序号",
        ]
      : [
          `Scan top-level files in ${folderName}`,
          "Create WorkBuddy Organized category folders",
          "Move files by type and auto-rename conflicts",
        ],
    actions: [{ type: "organize_folder", folder: folder.folder }],
  };
}

function createOpenUrlPlan(url: string, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  return {
    id: crypto.randomUUID(),
    title: zh ? "打开网页" : "Open website",
    summary: zh ? `打开 ${url}` : `Open ${url}`,
    sensitivity: "normal",
    steps: [zh ? "用系统默认浏览器打开网页" : "Open the URL in the default browser"],
    actions: [{ type: "open_url", url }],
  };
}

function createSearchPlan(query: string, engine: "bing" | "baidu", language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  const url =
    engine === "baidu"
      ? `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
      : `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const engineName = engine === "baidu" ? "Baidu" : "Bing";
  return {
    id: crypto.randomUUID(),
    title: zh ? "搜索网页" : "Search the web",
    summary: zh ? `用 ${engineName} 搜索：${shorten(query)}` : `Search ${engineName}: ${shorten(query)}`,
    sensitivity: "normal",
    steps: [zh ? "打开浏览器搜索结果页" : "Open the search results in the browser"],
    actions: [{ type: "open_url", url }],
  };
}

function createCopyPlan(text: string, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  return {
    id: crypto.randomUUID(),
    title: zh ? "复制文字" : "Copy text",
    summary: zh ? `复制到剪贴板：${shorten(text)}` : `Copy to clipboard: ${shorten(text)}`,
    sensitivity: "normal",
    steps: [zh ? "把文字写入系统剪贴板" : "Put the text on the system clipboard"],
    actions: [{ type: "set_clipboard", text }],
  };
}

function createPastePlan(text: string, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  return {
    id: crypto.randomUUID(),
    title: zh ? "输入文字" : "Paste text",
    summary: zh ? `向当前光标位置输入：${shorten(text)}` : `Paste at the current cursor: ${shorten(text)}`,
    sensitivity: "normal",
    steps: [
      zh
        ? "把文字复制到剪贴板并粘贴到当前光标位置"
        : "Copy the text to the clipboard and paste it at the current cursor",
    ],
    actions: [{ type: "paste_text", text }],
  };
}

function createNotePlan(text: string, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  return {
    id: crypto.randomUUID(),
    title: zh ? "新建笔记" : "Create note",
    summary: zh ? `打开记事本并写入：${shorten(text)}` : `Open Notepad and write: ${shorten(text)}`,
    sensitivity: "normal",
    steps: zh ? ["打开记事本", "输入笔记内容"] : ["Open Notepad", "Enter the note text"],
    actions: [
      { type: "open_app", app: "notepad" },
      { type: "wait", ms: 600 },
      { type: "paste_text", text },
    ],
  };
}

function createWechatMessagePlan(
  { contact, message }: ParsedWechatMessage,
  language: UiLanguage,
): ComputerTaskPlan {
  const zh = language === "zh";
  return {
    id: crypto.randomUUID(),
    title: zh ? "发送微信消息" : "Send WeChat message",
    summary: zh
      ? `准备给 ${contact} 发微信：${shorten(message)}`
      : `Prepare a WeChat message to ${contact}: ${shorten(message)}`,
    sensitivity: "sensitive",
    steps: zh
      ? ["打开微信", `搜索联系人：${contact}`, "输入消息内容", "发送前再次确认"]
      : ["Open WeChat", `Search contact: ${contact}`, "Enter the message", "Confirm once more before sending"],
    actions: [
      { type: "open_app", app: "wechat" },
      { type: "wait", ms: 1800 },
      { type: "hotkey", keys: ["ctrl", "f"] },
      { type: "wait", ms: 200 },
      { type: "paste_text", text: contact },
      { type: "wait", ms: 350 },
      { type: "key", key: "enter" },
      { type: "wait", ms: 900 },
      { type: "paste_text", text: message },
    ],
    finalTitle: zh ? "确认发送微信？" : "Send this WeChat message?",
    finalSummary: zh
      ? `消息已经填好。确认后会按 Enter 发送给 ${contact}。`
      : `The message is filled in. Confirm to press Enter and send it to ${contact}.`,
    finalSensitivity: "sensitive",
    finalActions: [{ type: "key", key: "enter" }],
  };
}

function createReminderPlan(message: string, delayMs: number, language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  const delayText = formatDelay(delayMs, language);
  return {
    id: crypto.randomUUID(),
    title: zh ? "设置提醒" : "Set reminder",
    summary: zh ? `${delayText} 后提醒：${shorten(message)}` : `Remind in ${delayText}: ${shorten(message)}`,
    sensitivity: "normal",
    steps: [zh ? "在 WorkBuddy 本地创建倒计时提醒" : "Create a local WorkBuddy countdown reminder"],
    actions: [],
    localTask: {
      type: "reminder",
      message,
      delayMs,
    },
  };
}

function parseOpenUrl(text: string): string | null {
  const url = text.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
  if (!url) return null;
  return /(打开|访问|浏览|open|visit|browse)/i.test(text) ? url : null;
}

function parseSearch(text: string): { query: string; engine: "bing" | "baidu" } | null {
  const trimmed = text.trim();
  const patterns = [
    /^(?:帮我|请)?(?:搜索|搜一下|查一下|查询)\s*[:：,， ]\s*(.+)$/i,
    /^(?:search|look up|google|bing)\s+(.+)$/i,
    /^百度\s*[:：,， ]?\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const query = cleanMessage(match[1]);
    if (!query || /^https?:\/\//i.test(query)) return null;
    const engine = /^百度/.test(trimmed) ? "baidu" : "bing";
    return { query, engine };
  }

  return null;
}

function parseWechatMessage(text: string): ParsedWechatMessage | null {
  if (!/(微信|wechat|weixin)/i.test(text)) return null;
  if (!/(发|发送|告诉|send)/i.test(text)) return null;

  const normalized = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /(?:帮我|请|麻烦你)?(?:给|向)\s*([^:：,，]+?)\s*(?:发|发送|告诉)(?:一?下)?(?:微信|消息)?\s*[:：,， ]\s*(.+)$/i,
    /(?:帮我|请|麻烦你)?(?:发|发送)(?:一?下)?(?:微信|消息)?(?:给|到)\s*([^:：,，]+?)\s*[:：,， ]\s*(.+)$/i,
    /(?:wechat|weixin|微信)(?:给|发给|发送给)\s*([^:：,，]+?)\s*[:：,， ]\s*(.+)$/i,
    /(?:给|向)\s*(.+?)\s*(?:发|发送)(?:微信|消息)\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const contact = cleanContact(match[1]);
    const message = cleanMessage(match[2]);
    if (contact && message) return { contact, message };
  }

  return null;
}

function parseNote(text: string): string | null {
  const patterns = [
    /^(?:帮我|请)?(?:新建|创建)?(?:一个)?(?:笔记|记事本|note)\s*[:：,， ]\s*(.+)$/i,
    /^(?:帮我|请)?(?:打开)?(?:记事本|notepad)(?:写|输入|记录)\s*[:：,， ]\s*(.+)$/i,
  ];
  return matchTextValue(text, patterns);
}

function parseCopyText(text: string): string | null {
  const patterns = [
    /^(?:帮我|请)?(?:复制|拷贝|copy)(?:到剪贴板)?\s*[:：,， ]\s*(.+)$/i,
    /^(?:copy)\s+(.+?)\s+(?:to clipboard|to the clipboard)$/i,
  ];
  return matchTextValue(text, patterns);
}

function parsePasteText(text: string): string | null {
  const patterns = [
    /^(?:帮我|请)?(?:输入|粘贴|打字|type|paste)\s*[:：,， ]\s*(.+)$/i,
    /^(?:type|paste)\s+(.+)$/i,
  ];
  return matchTextValue(text, patterns);
}

function parseReminder(text: string, language: UiLanguage): ComputerTaskPlan | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const patterns = [
    /^(?:提醒我|提醒|remind me|timer)\s*(?:(\d+)\s*(秒|分钟|小时|second|seconds|minute|minutes|min|mins|hour|hours|h)\s*(?:后|later|from now|in)?\s*)?[:：,， ]?(.+)$/i,
    /^(\d+)\s*(秒|分钟|小时|second|seconds|minute|minutes|min|mins|hour|hours|h)\s*(?:后|later|from now)?\s*(?:提醒我|提醒|remind me)?\s*[:：,， ]?(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const amount = Number(match[1]);
    const unit = match[2];
    const message = cleanMessage(match[3] || (language === "zh" ? "时间到了" : "Time is up"));
    if (!amount || !unit || !message) continue;
    const delayMs = unitToMs(amount, unit);
    if (delayMs < 1000 || delayMs > 24 * 60 * 60 * 1000) continue;
    return createReminderPlan(message, delayMs, language);
  }

  return null;
}

function findOpenApp(text: string): AppAlias | null {
  if (!/(打开|启动|唤起|截图|截屏|open|launch|start|snip|screenshot)/i.test(text)) return null;
  const normalized = text.toLocaleLowerCase();
  return appAliases.find((item) => item.keys.some((key) => normalized.includes(key.toLocaleLowerCase()))) ?? null;
}

function findOrganizeFolder(text: string): FolderAlias | null {
  if (!/(整理|归类|分类|收拾|organize|clean up|sort)/i.test(text)) return null;
  const normalized = text.toLocaleLowerCase();
  const matchedFolder =
    folderAliases.find((item) => item.keys.some((key) => normalized.includes(key.toLocaleLowerCase()))) ?? null;

  if (matchedFolder) return matchedFolder;
  if (/(文档|documents|docs)/i.test(text)) return folderAliases.find((item) => item.folder === "documents") ?? null;
  if (/(下载|downloads)/i.test(text)) return folderAliases.find((item) => item.folder === "downloads") ?? null;
  if (/(桌面|desktop)/i.test(text)) return folderAliases.find((item) => item.folder === "desktop") ?? null;
  return null;
}

function findOpenFolder(text: string): FolderAlias | null {
  if (!/(打开|进入|查看|open|show|go to)/i.test(text)) return null;
  const normalized = text.toLocaleLowerCase();
  return folderAliases.find((item) => item.keys.some((key) => normalized.includes(key.toLocaleLowerCase()))) ?? null;
}

function matchTextValue(text: string, patterns: RegExp[]): string | null {
  const normalized = text.trim();
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = cleanMessage(match[1]);
    if (value) return value;
  }
  return null;
}

function cleanContact(value: string): string {
  return value
    .replace(/^(联系人|好友|同事|朋友)\s*/, "")
    .replace(/[，,:：。.!！?？\s]+$/g, "")
    .trim();
}

function cleanMessage(value: string): string {
  return value
    .replace(/^(说|内容是|消息是|message is)\s*[:：,， ]*/i, "")
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .trim();
}

function unitToMs(amount: number, unit: string): number {
  const normalized = unit.toLocaleLowerCase();
  if (["秒", "second", "seconds"].includes(normalized)) return amount * 1000;
  if (["分钟", "minute", "minutes", "min", "mins"].includes(normalized)) return amount * 60 * 1000;
  return amount * 60 * 60 * 1000;
}

function formatDelay(delayMs: number, language: UiLanguage): string {
  const seconds = Math.round(delayMs / 1000);
  if (seconds < 60) return language === "zh" ? `${seconds} 秒` : `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return language === "zh" ? `${minutes} 分钟` : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return language === "zh" ? `${hours} 小时` : `${hours} hours`;
}

function shorten(value: string): string {
  return value.length > 38 ? `${value.slice(0, 38)}...` : value;
}
