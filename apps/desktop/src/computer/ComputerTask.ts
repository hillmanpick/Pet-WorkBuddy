import type { UiLanguage } from "../config/schema";
import { executeToolCall } from "../agent/tools/ToolRegistry";
import type { AgentToolCall } from "../agent/tools/ToolTypes";
import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

export type ComputerAction =
  | { type: "tool_call"; call: AgentToolCall }
  | { type: "open_app"; app: string }
  | { type: "open_folder"; folder: string }
  | { type: "organize_folder"; folder: string }
  | { type: "create_word_document"; app: "wps_writer" | "word"; text: string }
  | { type: "open_url"; url: string }
  | { type: "set_clipboard"; text: string }
  | { type: "paste_text"; text: string }
  | { type: "shell_command"; command: string }
  | { type: "hotkey"; keys: string[] }
  | { type: "key"; key: string }
  | { type: "wait"; ms: number };

export type TaskSensitivity = "normal" | "sensitive";

export type LocalTask = {
  type: "reminder";
  message: string;
  delayMs: number;
};

export type AgentTaskState = {
  userTask: string;
};

export type ComputerTaskPlan = {
  id: string;
  title: string;
  summary: string;
  sensitivity: TaskSensitivity;
  steps: string[];
  actions: ComputerAction[];
  completionMode?: "verified" | "needs_user_check";
  agentTask?: AgentTaskState;
  localTask?: LocalTask;
  finalTitle?: string;
  finalSummary?: string;
  finalSensitivity?: TaskSensitivity;
  finalActions?: ComputerAction[];
};

export type ActionResult = {
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
  { keys: ["wps", "wps office", "金山文档", "wps文字"], app: "wps_writer", zh: "WPS", en: "WPS Writer" },
  { keys: ["word", "microsoft word", "winword"], app: "word", zh: "Word", en: "Word" },
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

  const blankWordDocument = parseBlankWordDocument(prompt, language);
  if (blankWordDocument) return blankWordDocument;

  const note = parseNote(prompt);
  if (note) return createNotePlan(note, language);

  const copyText = parseCopyText(prompt);
  if (copyText) return createCopyPlan(copyText, language);

  const pasteText = parsePasteText(prompt);
  if (pasteText) return createPastePlan(pasteText, language);

  const firstResultSearch = parseSearchFirstResult(prompt);
  if (firstResultSearch) return createSearchFirstResultPlan(firstResultSearch.query, firstResultSearch.engine, language);

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

export function createPriorityComputerTaskPlan(text: string, language: UiLanguage): ComputerTaskPlan | null {
  const prompt = text.trim();
  if (!prompt) return null;

  const firstResultSearch = parseSearchFirstResult(prompt);
  if (firstResultSearch) return createSearchFirstResultPlan(firstResultSearch.query, firstResultSearch.engine, language);

  const search = parseSearch(prompt);
  if (search) return createSearchPlan(search.query, search.engine, language);

  const url = parseOpenUrl(prompt);
  if (url) return createOpenUrlPlan(url, language);

  return null;
}

export async function executeComputerActions(actions: ComputerAction[], taskId = "manual-task"): Promise<ActionResult[]> {
  if (!isTauriRuntime()) {
    throw new Error("Computer control is only available in the desktop app.");
  }

  const results: ActionResult[] = [];
  for (const [index, action] of actions.entries()) {
    if (action.type === "tool_call") {
      const result = await executeToolCall(taskId, action.call, true);
      results.push({ index, ok: result.ok, message: result.message });
    } else {
      const [result] = await invokeCommand<ActionResult[]>("execute_computer_actions", { actions: [action] });
      results.push(result ? { ...result, index } : { index, ok: false, message: "No result returned." });
    }

    if (!results[results.length - 1].ok) break;
  }

  return results;
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
    completionMode: "needs_user_check",
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
    completionMode: "needs_user_check",
  };
}

function createSearchFirstResultPlan(query: string, engine: "bing" | "baidu", language: UiLanguage): ComputerTaskPlan {
  const zh = language === "zh";
  const url =
    engine === "baidu"
      ? `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
      : `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const engineName = engine === "baidu" ? "Baidu" : "Bing";
  const tabCount = engine === "baidu" ? 7 : 5;
  return {
    id: crypto.randomUUID(),
    title: zh ? "搜索并打开第一个结果" : "Search and open first result",
    summary: zh
      ? `用 ${engineName} 搜索 ${shorten(query)}，然后尝试打开第一个搜索结果`
      : `Search ${engineName} for ${shorten(query)}, then try to open the first result`,
    sensitivity: "normal",
    steps: zh
      ? ["打开浏览器搜索结果页", "等待网页加载", "用键盘焦点移动到第一个结果", "按 Enter 打开"]
      : ["Open the search results page", "Wait for the page to load", "Move keyboard focus to the first result", "Press Enter"],
    actions: [
      { type: "open_url", url },
      { type: "wait", ms: 2400 },
      ...Array.from({ length: tabCount }, () => ({ type: "key" as const, key: "tab" })),
      { type: "key", key: "enter" },
    ],
    completionMode: "needs_user_check",
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

function createBlankWordDocumentPlan(
  app: { id: "wps_writer" | "word"; zh: string; en: string },
  language: UiLanguage,
  content?: string,
): ComputerTaskPlan {
  const zh = language === "zh";
  const appName = zh ? app.zh : app.en;
  const documentText = content?.trim() ? content : "";
  const hasContent = documentText.length > 0;
  return {
    id: crypto.randomUUID(),
    title: hasContent
      ? zh
        ? "新建 Word 文档并写入内容"
        : "Create Word document with content"
      : zh
        ? "新建空白 Word 文档"
        : "Create blank Word document",
    summary: hasContent
      ? zh
        ? `打开 ${appName} 并在 Word 文档中写入：${shorten(documentText)}`
        : `Open ${appName}, create a Word document, and write: ${shorten(documentText)}`
      : zh
        ? `打开 ${appName} 并新建空白 Word 文档`
        : `Open ${appName} and create a blank Word document`,
    sensitivity: "normal",
    steps: hasContent
      ? zh
        ? ["创建一个 Word 文档", `写入：${shorten(documentText)}`, `用 ${appName} 打开文档`]
        : ["Create a Word document", `Write: ${shorten(documentText)}`, `Open the document with ${appName}`]
      : zh
        ? ["创建一个空白 Word 文档", `用 ${appName} 打开文档`]
        : ["Create a blank Word document", `Open the document with ${appName}`],
    actions: [{ type: "create_word_document", app: app.id, text: documentText }],
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

function parseSearchFirstResult(text: string): { query: string; engine: "bing" | "baidu" } | null {
  const trimmed = text.trim();
  const wantsFirstResult =
    /(?:点开|打开|点击|进入|open|click)\s*(?:搜索结果)?(?:的)?(?:第一个|第一条|首个|first)\s*(?:链接|结果|link|result)?/i.test(
      trimmed,
    ) || /(?:第一个|第一条|首个|first)\s*(?:链接|结果|link|result)/i.test(trimmed);
  if (!wantsFirstResult) return null;

  const withoutFirstResultInstruction = trimmed
    .replace(
      /(?:然后|并且|并|再|,|，|。)?\s*(?:点开|打开|点击|进入|open|click)\s*(?:搜索结果)?(?:的)?(?:第一个|第一条|首个|first)\s*(?:链接|结果|link|result)?.*$/i,
      "",
    )
    .trim();
  const directSearch = parseSearch(withoutFirstResultInstruction);
  if (directSearch) return directSearch;

  const explicitEngine = trimmed.match(
    /(?:使用|用|在)?\s*(百度|baidu|必应|bing|谷歌|google).*?(?:搜索|搜一下|查询|查一下|search|look up)\s*[:：,， ]?\s*(.+?)(?:然后|并且|并|再|点开|打开|点击|进入|open|click|$)/i,
  );
  if (explicitEngine) {
    const query = cleanMessage(explicitEngine[2]);
    if (query && !/^https?:\/\//i.test(query)) {
      return { query, engine: /(百度|baidu)/i.test(explicitEngine[1]) ? "baidu" : "bing" };
    }
  }

  const genericSearch = trimmed.match(
    /(?:搜索|搜一下|查询|查一下|search|look up)\s*[:：,， ]?\s*(.+?)(?:然后|并且|并|再|点开|打开|点击|进入|open|click|$)/i,
  );
  if (genericSearch) {
    const query = cleanMessage(genericSearch[1]);
    if (query && !/^https?:\/\//i.test(query)) {
      return { query, engine: /(百度|baidu)/i.test(trimmed) ? "baidu" : "bing" };
    }
  }

  return null;
}

function parseSearch(text: string): { query: string; engine: "bing" | "baidu" } | null {
  const trimmed = text.trim();
  const patterns = [
    /^(?:帮我|请)?(?:打开|启动)?(?:默认)?(?:浏览器)?(?:并|然后|后)?(?:进入|打开|访问)?\s*(百度|baidu|必应|bing|谷歌|google)(?:[，,。.]|然后|并|后|\s)*(?:搜索|搜一下|查询|查一下|search|look up)\s*[:：,， ]?\s*(.+)$/i,
    /^(?:帮我|请)?(?:在|用)\s*(百度|baidu|必应|bing|谷歌|google)\s*(?:搜索|搜一下|查询|查一下|search|look up)\s*[:：,， ]?\s*(.+)$/i,
    /^(百度|baidu|必应|bing|谷歌|google)\s*(?:搜索|搜一下|查询|查一下|search|look up)\s*[:：,， ]?\s*(.+)$/i,
    /^(?:帮我|请)?(?:搜索|搜一下|查一下|查询)\s*[:：,， ]\s*(.+)$/i,
    /^(?:search|look up|google|bing)\s+(.+)$/i,
    /^百度\s*[:：,， ]?\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    const hasExplicitEngine = match.length >= 3;
    const engineText = hasExplicitEngine ? match[1] : trimmed;
    const query = cleanMessage(hasExplicitEngine ? match[2] : match[1]);
    if (!query || /^https?:\/\//i.test(query)) return null;
    const engine = /(百度|baidu)/i.test(engineText) ? "baidu" : "bing";
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

function parseBlankWordDocument(text: string, language: UiLanguage): ComputerTaskPlan | null {
  const normalized = text.toLocaleLowerCase();
  const mentionsDocument = /(wps|word|winword|docx?|文档|文字)/i.test(normalized);
  const wantsBlank = /(空白|新建|创建|生成|建一个|blank|new|create)/i.test(normalized);
  const wantsAction = /(打开|启动|唤起|open|launch|start|生成|新建|创建|create|new)/i.test(normalized);
  if (!mentionsDocument || !wantsBlank || !wantsAction) return null;

  const prefersWps = /(wps|金山)/i.test(normalized);
  const app = prefersWps
    ? { id: "wps_writer" as const, zh: "WPS", en: "WPS Writer" }
    : { id: "word" as const, zh: "Word", en: "Word" };
  return createBlankWordDocumentPlan(app, language, parseDocumentInput(text));
}

function parseDocumentInput(text: string): string | undefined {
  const requestedArticle = parseGeneratedArticleRequest(text);
  if (requestedArticle) return requestedArticle;

  const patterns = [
    /(?:输入|写入|打字|键入|type|paste)\s*[:：,， ]?\s*(.+)$/i,
    /(?:在\s*(?:word|wps|文档|文字).*?)(?:写|输入)\s*[:：,， ]?\s*(.+)$/i,
    /(?:内容|文字)\s*(?:是|为|:|：)\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = cleanMessage(match[1]);
    if (value) return value;
  }

  return undefined;
}

function parseGeneratedArticleRequest(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, "");
  const wantsArticle = /(写|撰写|生成|随便写).*(文章|作文|短文|小作文)/i.test(normalized);
  if (!wantsArticle) return undefined;

  const topic =
    text.match(/(?:关于|有关|围绕)\s*([^，。,.!?！？]+?)\s*(?:的)?(?:文章|作文|短文|小作文)/i)?.[1]?.trim() ??
    text.match(/(?:写|撰写|生成)\s*(?:一篇)?\s*([^，。,.!?！？]+?)\s*(?:的)?(?:文章|作文|短文|小作文)/i)?.[1]?.trim();

  const cleanTopic = topic && !/(随便|一篇|一个|篇|文章|作文|短文|小作文)/.test(topic) ? topic : undefined;
  return generatedArticle(cleanTopic);
}

function generatedArticle(topic?: string): string {
  if (topic) {
    return [
      `${topic}`,
      "",
      `关于${topic}，最重要的是看到它和日常生活之间的联系。很多事情看起来离我们很远，但真正落到行动里，往往都由一个清晰的目标、一次认真的选择和持续的执行组成。`,
      "",
      `如果想把${topic}做好，不能只停留在想法上。我们需要先弄清楚问题是什么，再把目标拆成可以完成的小步骤。这样既能减少犹豫，也能让每一次努力都有方向。`,
      "",
      `当然，过程里也会遇到变化和困难。真正有效的方法不是回避问题，而是在反馈中调整节奏。只要愿意持续观察、总结和改进，很多看似复杂的事情都会慢慢变得可控。`,
      "",
      `所以，${topic}并不是一个空洞的概念。它提醒我们，在面对任务和生活时，要保持耐心、判断力和行动力。把每一步做好，结果自然会变得更踏实。`,
    ].join("\n");
  }

  return [
    "把普通的一天过好",
    "",
    "很多时候，我们总觉得真正重要的生活应该发生在某个特别的时刻。可是回头看，决定一个人状态的，往往不是那些突然出现的大事，而是每天重复的小选择。",
    "",
    "把普通的一天过好，首先要知道自己正在做什么。早上醒来时，可以给今天定一个简单的重点，不必太宏大，只要足够明确。比如完成一项工作、整理一个角落、认真读几页书，或者和重要的人好好说几句话。",
    "",
    "其次，要允许事情不完全按照计划发生。计划的意义不是把一天锁死，而是在变化出现时，仍然知道自己可以回到哪里。遇到打断时，不必急着责怪自己，只要重新开始，很多事情就还来得及。",
    "",
    "最后，要给自己一点收尾的时间。晚上回顾今天，不是为了挑错，而是为了看见已经完成的部分。哪怕只是很小的一步，也说明这一天没有白白过去。",
    "",
    "生活的质量，常常藏在这些普通的细节里。认真对待每一天，并不是要把自己逼得很紧，而是愿意用稳定的行动，把日子一点点过得更清楚、更踏实。",
  ].join("\n");
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
