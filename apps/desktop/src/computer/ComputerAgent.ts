import type { ChatMessage, WorkBuddyConfig } from "../config/schema";
import { getProvider } from "../providers/ProviderRegistry";
import { getApiKey } from "../settings/SettingsStore";
import type { ActionResult, ComputerAction, ComputerTaskPlan, TaskSensitivity } from "./ComputerTask";

export type AgentActionObservation = {
  iteration: number;
  action: ComputerAction;
  result: ActionResult;
};

export type AgentContinuation = {
  status: "complete" | "continue" | "needs_user" | "failed";
  message: string;
  plan?: ComputerTaskPlan;
};

type AgentPlanPayload = {
  intent?: "computer_task" | "chat";
  title?: string;
  summary?: string;
  sensitivity?: TaskSensitivity;
  steps?: unknown[];
  actions?: unknown[];
};

type AgentReviewPayload = {
  status?: "complete" | "continue" | "needs_user" | "failed";
  message?: string;
  title?: string;
  summary?: string;
  sensitivity?: TaskSensitivity;
  steps?: unknown[];
  actions?: unknown[];
};

const COMPUTER_REQUEST_PATTERN =
  /(帮我|请|打开|启动|新建|创建|生成|写|整理|复制|粘贴|输入|发送|发给|搜索|下载|安装|运行|执行|改名|移动|删除|压缩|解压|设置|提醒|电脑|文件|文件夹|网页|微信|wps|word|excel|ppt|浏览器|记事本|powershell|cmd|open|start|launch|create|write|run|execute|copy|paste|send|search|download|install|rename|move|delete|organize|folder|file|browser|app)/i;

const SUPPORTED_ACTIONS = `[
  {"type":"open_app","app":"wechat|wps_writer|word|explorer|notepad|calculator|paint|settings|screenshot"},
  {"type":"open_folder","folder":"desktop|downloads|documents|pictures|music|videos|home"},
  {"type":"open_url","url":"https://..."},
  {"type":"set_clipboard","text":"..."},
  {"type":"paste_text","text":"..."},
  {"type":"create_word_document","app":"wps_writer|word","text":"document text"},
  {"type":"hotkey","keys":["ctrl","n"]},
  {"type":"key","key":"enter"},
  {"type":"wait","ms":1000},
  {"type":"shell_command","command":"PowerShell command"}
]`;

const AGENT_SYSTEM_PROMPT = `You are WorkBuddy Agent Planner, a desktop-computer task planner.

Return ONLY valid JSON. Do not use markdown.

Your job is to decide whether the user's message is a computer task. If it is ordinary chat, return:
{"intent":"chat"}

If it is a computer task, return this shape:
{
  "intent": "computer_task",
  "title": "short title",
  "summary": "what will be done",
  "sensitivity": "normal" | "sensitive",
  "steps": ["visible user-facing steps"],
  "actions": ${SUPPORTED_ACTIONS}
}

Rules:
- Prefer structured actions over shell_command.
- Use shell_command only when the task cannot be done with the structured tools.
- Mark sensitivity as "sensitive" for shell_command, file deletion/move/rename, sending messages, changing system settings, installing software, or anything irreversible.
- Do not create actions that steal credentials, bypass login, hide from the user, disable security tools, or exfiltrate private data.
- If the user asks to write content and does not provide exact text, generate useful content directly in the action text.
- For Word/WPS document tasks, prefer create_word_document with complete text instead of keyboard typing.
- Keep actions reasonably small. Max 12 actions.`;

const AGENT_REVIEW_PROMPT = `You are WorkBuddy Agent Supervisor.

Return ONLY valid JSON. Do not use markdown.

You will receive the original user task, the last plan, and local execution results.
Decide whether the user's task is actually complete.

Return one of:
{"status":"complete","message":"brief completion message"}
{"status":"continue","message":"why another step is needed","title":"short title","summary":"next step summary","sensitivity":"normal|sensitive","steps":["visible steps"],"actions":${SUPPORTED_ACTIONS}}
{"status":"needs_user","message":"what the user must do manually"}
{"status":"failed","message":"why the task cannot be completed"}

Rules:
- Never mark complete just because actions were attempted. Mark complete only if the execution results show the intended outcome.
- Treat open_url results as "the OS accepted an open request", not proof that the browser page loaded or that a search result is visible.
- If an action failed, produce corrected actions when possible; otherwise return needs_user or failed.
- Prefer structured actions over shell_command.
- Use shell_command only when the task cannot be done with structured actions.
- Mark sensitivity as "sensitive" for shell_command, file deletion/move/rename, sending messages, changing system settings, installing software, or anything irreversible.
- Do not bypass logins, verification, permission prompts, or platform safety controls.
- Keep follow-up actions small. Max 8 actions.`;

export function looksLikeComputerRequest(text: string): boolean {
  return COMPUTER_REQUEST_PATTERN.test(text);
}

export function isAgentTaskPlan(plan: ComputerTaskPlan): boolean {
  return Boolean(plan.agentTask?.userTask);
}

export async function createAgentTaskPlan(
  config: WorkBuddyConfig,
  text: string,
  history: ChatMessage[],
): Promise<ComputerTaskPlan | null> {
  const result = await callAgentModel(config, AGENT_SYSTEM_PROMPT, buildPlanningUserMessage(text, history));
  return parseAgentTaskPlan(result.text, text);
}

export async function continueAgentTaskPlan(
  config: WorkBuddyConfig,
  plan: ComputerTaskPlan,
  observations: AgentActionObservation[],
  history: ChatMessage[],
): Promise<AgentContinuation> {
  const userTask = plan.agentTask?.userTask ?? plan.summary;
  const result = await callAgentModel(
    config,
    AGENT_REVIEW_PROMPT,
    buildReviewUserMessage(userTask, plan, observations, history),
  );
  return parseAgentContinuation(result.text, userTask, observations);
}

async function callAgentModel(config: WorkBuddyConfig, systemPrompt: string, content: string) {
  const providerConfig = config.providers[config.activeProvider];
  const provider = getProvider(config.activeProvider);
  const apiKey = await getApiKey(config.activeProvider);

  return provider.chat({
    providerId: config.activeProvider,
    config: {
      ...providerConfig,
      systemPrompt,
      temperature: Math.min(providerConfig.temperature, 0.2),
      maxTokens: Math.max(providerConfig.maxTokens, 1800),
    },
    apiKey,
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        createdAt: Date.now(),
        content,
      },
    ],
  });
}

function buildPlanningUserMessage(text: string, history: ChatMessage[]): string {
  const context = history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return `Recent conversation:
${context || "(empty)"}

User task:
${text}`;
}

function buildReviewUserMessage(
  userTask: string,
  plan: ComputerTaskPlan,
  observations: AgentActionObservation[],
  history: ChatMessage[],
): string {
  const context = history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const execution = observations.map((item) => ({
    iteration: item.iteration,
    action: item.action,
    ok: item.result.ok,
    message: item.result.message,
  }));

  return JSON.stringify(
    {
      recentConversation: context || "(empty)",
      userTask,
      lastPlan: {
        title: plan.title,
        summary: plan.summary,
        sensitivity: plan.sensitivity,
        steps: plan.steps,
        actions: plan.actions,
      },
      executionResults: execution,
    },
    null,
    2,
  );
}

function parseAgentTaskPlan(text: string, userTask: string): ComputerTaskPlan | null {
  const payload = parseJsonPayload<AgentPlanPayload>(text);
  if (!payload || payload.intent !== "computer_task") return null;

  const actions = sanitizeActions(payload.actions ?? [], 12);
  if (!actions.length) return null;

  const sensitivity = inferSensitivity(payload.sensitivity === "sensitive" ? "sensitive" : "normal", actions);
  return {
    id: crypto.randomUUID(),
    title: normalizeText(payload.title, "Computer task"),
    summary: normalizeText(payload.summary, "Run a computer task"),
    sensitivity,
    steps: normalizeSteps(Array.isArray(payload.steps) ? payload.steps : []),
    actions,
    agentTask: { userTask },
  };
}

function parseAgentContinuation(
  text: string,
  userTask: string,
  observations: AgentActionObservation[],
): AgentContinuation {
  const payload = parseJsonPayload<AgentReviewPayload>(text);
  const lastIteration = Math.max(...observations.map((item) => item.iteration), 0);
  const hasFailure = observations.some((item) => item.iteration === lastIteration && !item.result.ok);
  if (!payload?.status) {
    return {
      status: hasFailure ? "failed" : "needs_user",
      message: hasFailure
        ? "部分电脑操作失败了，而且模型没有给出可继续执行的修正计划。"
        : "电脑操作已经执行，但模型没有返回有效的完成判断。",
    };
  }

  if (payload.status === "continue") {
    const actions = sanitizeActions(payload.actions ?? [], 8);
    if (!actions.length) {
      return {
        status: "needs_user",
        message: normalizeText(payload.message, "还需要继续处理，但模型没有给出下一步动作。"),
      };
    }

    const sensitivity = inferSensitivity(payload.sensitivity === "sensitive" ? "sensitive" : "normal", actions);
    return {
      status: "continue",
      message: normalizeText(payload.message, "继续执行下一步。"),
      plan: {
        id: crypto.randomUUID(),
        title: normalizeText(payload.title, "Continue computer task"),
        summary: normalizeText(payload.summary, normalizeText(payload.message, "Continue computer task")),
        sensitivity,
        steps: normalizeSteps(Array.isArray(payload.steps) ? payload.steps : []),
        actions,
        agentTask: { userTask },
      },
    };
  }

  if (payload.status === "complete" && hasFailure) {
    return {
      status: "failed",
      message: "至少有一步电脑操作失败了，所以我不会把这个任务标记为完成。",
    };
  }

  return {
    status: payload.status,
    message: normalizeText(
      payload.message,
      payload.status === "complete" ? "任务已经完成。" : "任务无法自动继续。",
    ),
  };
}

function parseJsonPayload<T>(text: string): T | null {
  const trimmed = text.trim();
  const jsonText =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed
      : trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ??
        trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) return null;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}

function sanitizeActions(values: unknown[], maxActions: number): ComputerAction[] {
  const actions: ComputerAction[] = [];

  values.slice(0, maxActions).forEach((value) => {
    if (!value || typeof value !== "object") return;
    const action = value as Record<string, unknown>;
    if (typeof action.type !== "string") return;

    switch (action.type) {
      case "open_app":
        if (typeof action.app === "string") actions.push({ type: "open_app", app: action.app });
        return;
      case "open_folder":
        if (typeof action.folder === "string") actions.push({ type: "open_folder", folder: action.folder });
        return;
      case "open_url":
        if (typeof action.url === "string" && /^https?:\/\//i.test(action.url)) {
          actions.push({ type: "open_url", url: action.url });
        }
        return;
      case "set_clipboard":
        if (typeof action.text === "string") actions.push({ type: "set_clipboard", text: action.text.slice(0, 4000) });
        return;
      case "paste_text":
        if (typeof action.text === "string") actions.push({ type: "paste_text", text: action.text.slice(0, 4000) });
        return;
      case "create_word_document":
        if (typeof action.text === "string") {
          actions.push({
            type: "create_word_document",
            app: action.app === "word" ? "word" : "wps_writer",
            text: action.text.slice(0, 20_000),
          });
        }
        return;
      case "hotkey":
        if (Array.isArray(action.keys)) {
          actions.push({
            type: "hotkey",
            keys: action.keys.filter((key) => typeof key === "string").slice(0, 4) as string[],
          });
        }
        return;
      case "key":
        if (typeof action.key === "string") actions.push({ type: "key", key: action.key });
        return;
      case "wait":
        if (typeof action.ms === "number") actions.push({ type: "wait", ms: Math.max(0, Math.min(10_000, action.ms)) });
        return;
      case "shell_command":
        if (typeof action.command === "string") actions.push({ type: "shell_command", command: action.command.slice(0, 4000) });
        return;
      default:
        return;
    }
  });

  return actions;
}

function inferSensitivity(base: TaskSensitivity, actions: ComputerAction[]): TaskSensitivity {
  if (base === "sensitive") return "sensitive";
  return actions.some((action) => {
    if (action.type === "shell_command" || action.type === "organize_folder") return true;
    if (action.type === "key" && action.key.toLowerCase() === "enter") return true;
    return false;
  })
    ? "sensitive"
    : "normal";
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : fallback;
}

function normalizeSteps(value: unknown[]): string[] {
  const steps = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8);
  return steps.length ? steps : ["Plan the task", "Run the approved actions"];
}
