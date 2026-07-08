import { invokeCommand, isTauriRuntime } from "../../tauri/tauriClient";
import { appendAuditLog, createAuditEntry } from "./AuditLog";
import type {
  AgentToolCall,
  ToolDefinition,
  ToolExecutionResult,
  ToolPluginManifest,
  ToolRisk,
} from "./ToolTypes";

type TauriToolAction = Record<string, unknown>;

export const builtinPluginManifests: ToolPluginManifest[] = [
  {
    id: "filesystem",
    name: "文件系统插件",
    permissions: ["filesystem:read", "filesystem:write"],
    tools: [
      {
        name: "fs.list",
        description: "列出本地目录内容。",
        risk: "low",
        permissions: ["filesystem:read"],
        inputSchema: objectSchema({ root: { type: "string" } }, ["root"]),
      },
      {
        name: "fs.search",
        description: "在本地目录中按文件名搜索文件。",
        risk: "low",
        permissions: ["filesystem:read"],
        inputSchema: objectSchema({ root: { type: "string" }, query: { type: "string" } }, ["root", "query"]),
      },
      {
        name: "fs.read",
        description: "读取文本文件内容，结果会截断。",
        risk: "medium",
        permissions: ["filesystem:read"],
        inputSchema: objectSchema({ path: { type: "string" } }, ["path"]),
      },
      {
        name: "fs.write",
        description: "写入文本文件。",
        risk: "high",
        permissions: ["filesystem:write"],
        inputSchema: objectSchema({ path: { type: "string" }, text: { type: "string" } }, ["path", "text"]),
      },
      {
        name: "fs.copy",
        description: "复制文件。",
        risk: "medium",
        permissions: ["filesystem:read", "filesystem:write"],
        inputSchema: objectSchema({ from: { type: "string" }, to: { type: "string" } }, ["from", "to"]),
      },
      {
        name: "fs.move",
        description: "移动文件。",
        risk: "high",
        permissions: ["filesystem:write"],
        inputSchema: objectSchema({ from: { type: "string" }, to: { type: "string" } }, ["from", "to"]),
      },
      {
        name: "fs.delete_to_recycle_bin",
        description: "把文件或文件夹移动到回收站。",
        risk: "critical",
        permissions: ["filesystem:write"],
        inputSchema: objectSchema({ path: { type: "string" } }, ["path"]),
      },
    ],
  },
  {
    id: "terminal",
    name: "终端插件",
    permissions: ["terminal:run"],
    tools: [
      {
        name: "terminal.run",
        description: "运行 PowerShell、cmd、git、npm 或 python 命令，有超时和输出截断。",
        risk: "high",
        permissions: ["terminal:run"],
        inputSchema: objectSchema(
          {
            shell: { type: "string", enum: ["powershell", "cmd", "git", "npm", "python"] },
            command: { type: "string" },
            cwd: { type: "string" },
            timeoutMs: { type: "number" },
          },
          ["shell", "command"],
        ),
      },
    ],
  },
  {
    id: "browser",
    name: "浏览器插件",
    permissions: ["browser:open", "network:access"],
    tools: [
      {
        name: "browser.open",
        description: "用系统默认浏览器打开网页。",
        risk: "medium",
        permissions: ["browser:open", "network:access"],
        inputSchema: objectSchema({ url: { type: "string" } }, ["url"]),
      },
      {
        name: "browser.screenshot",
        description: "打开网页后提示用户用系统截图工具截图。Playwright 自动化预留给后续 MCP/sidecar 插件。",
        risk: "medium",
        permissions: ["browser:open", "screen:capture"],
        inputSchema: objectSchema({ url: { type: "string" } }, ["url"]),
      },
    ],
  },
  {
    id: "app",
    name: "应用控制插件",
    permissions: ["app:open"],
    tools: [
      {
        name: "app.open",
        description: "打开白名单应用，例如 wechat、browser、vscode、notepad、wps_writer、word。",
        risk: "low",
        permissions: ["app:open"],
        inputSchema: objectSchema({ app: { type: "string" } }, ["app"]),
      },
      {
        name: "app.open_file",
        description: "用系统默认应用打开指定文件。",
        risk: "medium",
        permissions: ["app:open", "filesystem:read"],
        inputSchema: objectSchema({ path: { type: "string" } }, ["path"]),
      },
    ],
  },
  {
    id: "screen",
    name: "屏幕插件",
    permissions: ["screen:capture", "screen:control"],
    tools: [
      {
        name: "screen.screenshot",
        description: "截取当前主屏幕并保存为 PNG。",
        risk: "medium",
        permissions: ["screen:capture"],
        inputSchema: objectSchema({}),
      },
      {
        name: "screen.ocr",
        description: "OCR 识别屏幕文字。当前版本会返回能力未安装提示。",
        risk: "medium",
        permissions: ["screen:capture"],
        inputSchema: objectSchema({}),
      },
      {
        name: "screen.hotkey",
        description: "按下系统快捷键。",
        risk: "high",
        permissions: ["screen:control"],
        inputSchema: objectSchema({ keys: { type: "array", items: { type: "string" } } }, ["keys"]),
      },
      {
        name: "screen.click",
        description: "移动鼠标到屏幕坐标并点击。",
        risk: "high",
        permissions: ["screen:control"],
        inputSchema: objectSchema(
          {
            x: { type: "number" },
            y: { type: "number" },
            button: { type: "string", enum: ["left", "right", "middle"] },
          },
          ["x", "y"],
        ),
      },
      {
        name: "screen.type_text",
        description: "向当前焦点输入文本。",
        risk: "high",
        permissions: ["screen:control"],
        inputSchema: objectSchema({ text: { type: "string" } }, ["text"]),
      },
    ],
  },
  {
    id: "clipboard",
    name: "剪贴板插件",
    permissions: ["clipboard:read", "clipboard:write"],
    tools: [
      {
        name: "clipboard.read_text",
        description: "读取系统剪贴板文本。",
        risk: "medium",
        permissions: ["clipboard:read"],
        inputSchema: objectSchema({}),
      },
      {
        name: "clipboard.write_text",
        description: "写入系统剪贴板文本。",
        risk: "medium",
        permissions: ["clipboard:write"],
        inputSchema: objectSchema({ text: { type: "string" } }, ["text"]),
      },
      {
        name: "clipboard.paste_text",
        description: "写入剪贴板并粘贴到当前焦点。",
        risk: "high",
        permissions: ["clipboard:write", "screen:control"],
        inputSchema: objectSchema({ text: { type: "string" } }, ["text"]),
      },
    ],
  },
  {
    id: "office",
    name: "Office 文档插件",
    permissions: ["office:write", "filesystem:write"],
    tools: [
      {
        name: "office.create_word",
        description: "创建 Word 兼容文档并用 WPS/Word 打开。",
        risk: "medium",
        permissions: ["office:write", "filesystem:write"],
        inputSchema: objectSchema(
          { app: { type: "string", enum: ["wps_writer", "word"] }, text: { type: "string" } },
          ["text"],
        ),
      },
    ],
  },
  {
    id: "confirm",
    name: "权限确认插件",
    permissions: ["confirm:ask"],
    tools: [
      {
        name: "confirm.ask",
        description: "请求用户确认高风险操作。WorkBuddy Host 会强制执行确认策略。",
        risk: "high",
        permissions: ["confirm:ask"],
        inputSchema: objectSchema({ message: { type: "string" } }, ["message"]),
      },
    ],
  },
];

const tools = new Map<string, ToolDefinition>();
builtinPluginManifests.forEach((plugin) => {
  plugin.tools.forEach((tool) => tools.set(tool.name, tool));
});

export function listToolDefinitions(): ToolDefinition[] {
  return [...tools.values()];
}

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function describeToolsForPrompt(): string {
  return listToolDefinitions()
    .map((tool) =>
      JSON.stringify({
        name: tool.name,
        description: tool.description,
        risk: tool.risk,
        permissions: tool.permissions,
        inputSchema: tool.inputSchema,
      }),
    )
    .join("\n");
}

export function inferToolRisk(call: AgentToolCall): ToolRisk {
  return getToolDefinition(call.tool)?.risk ?? "high";
}

export async function executeToolCall(taskId: string, call: AgentToolCall, approved: boolean): Promise<ToolExecutionResult> {
  const definition = getToolDefinition(call.tool);
  if (!definition) {
    return { ok: false, message: `Unknown tool: ${call.tool}` };
  }

  const startedAt = Date.now();
  const result = await executeBuiltinTool(call);
  const endedAt = Date.now();
  appendAuditLog(createAuditEntry({ taskId, call, definition, approved, startedAt, endedAt, result }));
  return result;
}

async function executeBuiltinTool(call: AgentToolCall): Promise<ToolExecutionResult> {
  if (!isTauriRuntime()) {
    return { ok: false, message: "Agent tools are only available in the desktop app." };
  }

  const action = toolCallToTauriAction(call);
  if (!action) {
    return { ok: false, message: `Tool is declared but not implemented yet: ${call.tool}` };
  }

  const results = await invokeCommand<Array<{ ok: boolean; message: string }>>("execute_computer_actions", {
    actions: [action],
  });
  const result = results[0];
  return result ? { ok: result.ok, message: result.message } : { ok: false, message: "Tool returned no result." };
}

function toolCallToTauriAction(call: AgentToolCall): TauriToolAction | null {
  const args = call.arguments;
  switch (call.tool) {
    case "fs.list":
      return { type: "fs_list", root: stringArg(args.root) };
    case "fs.search":
      return { type: "fs_search", root: stringArg(args.root), query: stringArg(args.query) };
    case "fs.read":
      return { type: "fs_read", path: stringArg(args.path) };
    case "fs.write":
      return { type: "fs_write", path: stringArg(args.path), text: stringArg(args.text) };
    case "fs.copy":
      return { type: "fs_copy", from: stringArg(args.from), to: stringArg(args.to) };
    case "fs.move":
      return { type: "fs_move", from: stringArg(args.from), to: stringArg(args.to) };
    case "fs.delete_to_recycle_bin":
      return { type: "fs_delete_to_recycle_bin", path: stringArg(args.path) };
    case "terminal.run":
      return {
        type: "terminal_command",
        shell: stringArg(args.shell),
        command: stringArg(args.command),
        cwd: optionalStringArg(args.cwd),
        timeout_ms: numberArg(args.timeoutMs, 30_000),
      };
    case "browser.open":
      return { type: "open_url", url: stringArg(args.url) };
    case "browser.screenshot":
      return { type: "browser_screenshot", url: stringArg(args.url) };
    case "app.open":
      return { type: "open_app", app: normalizeApp(stringArg(args.app)) };
    case "app.open_file":
      return { type: "open_file", path: stringArg(args.path) };
    case "screen.screenshot":
      return { type: "screen_screenshot" };
    case "screen.ocr":
      return { type: "screen_ocr" };
    case "screen.hotkey":
      return { type: "hotkey", keys: arrayStringArg(args.keys) };
    case "screen.click":
      return {
        type: "screen_click",
        x: numberArg(args.x, 0),
        y: numberArg(args.y, 0),
        button: optionalStringArg(args.button),
      };
    case "screen.type_text":
      return { type: "paste_text", text: stringArg(args.text) };
    case "clipboard.read_text":
      return { type: "clipboard_read_text" };
    case "clipboard.write_text":
      return { type: "set_clipboard", text: stringArg(args.text) };
    case "clipboard.paste_text":
      return { type: "paste_text", text: stringArg(args.text) };
    case "office.create_word":
      return { type: "create_word_document", app: stringArg(args.app, "wps_writer"), text: stringArg(args.text) };
    case "confirm.ask":
      return { type: "wait", ms: 1 };
    default:
      return null;
  }
}

function objectSchema(properties: Record<string, unknown>, required: string[] = []) {
  return {
    type: "object" as const,
    properties,
    required,
    additionalProperties: false,
  };
}

function stringArg(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalStringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberArg(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function arrayStringArg(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 4) : [];
}

function normalizeApp(app: string): string {
  const normalized = app.trim().toLowerCase();
  if (["browser", "default_browser", "edge", "chrome"].includes(normalized)) return "browser";
  if (["vscode", "vs code", "code"].includes(normalized)) return "vscode";
  return normalized;
}
