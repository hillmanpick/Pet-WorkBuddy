import type { ChatMessage, WorkBuddyConfig } from "../config/schema";
import { describeToolsForPrompt, getToolDefinition, inferToolRisk } from "../agent/tools/ToolRegistry";
import { riskToSensitivity } from "../agent/tools/PermissionEngine";
import type { AgentToolCall } from "../agent/tools/ToolTypes";
import { buildLearningContext } from "../agent/learning/LearningStore";
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
  toolCalls?: unknown[];
};

type AgentReviewPayload = {
  status?: "complete" | "continue" | "needs_user" | "failed";
  message?: string;
  title?: string;
  summary?: string;
  sensitivity?: TaskSensitivity;
  steps?: unknown[];
  actions?: unknown[];
  toolCalls?: unknown[];
};

const COMPUTER_REQUEST_PATTERN =
  /(帮我|请|打开|启动|新建|创建|生成|写|整理|复制|粘贴|输入|发送|发给|搜索|查询|点开|点击|下载|安装|运行|执行|改名|移动|删除|压缩|解压|设置|提醒|电脑|文件|文件夹|网页|链接|微信|百度|必应|浏览器|记事本|wps|word|excel|ppt|powershell|cmd|open|start|launch|create|write|run|execute|copy|paste|send|search|download|install|rename|move|delete|organize|folder|file|browser|app|click|link)/i;

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
  "toolCalls": [
    {"tool":"tool.name","arguments":{},"reason":"why this tool is needed"}
  ]
}

Available tools:
__TOOLS__

Rules:
- Use only tools from the available tools list.
- Prefer specialized tools over terminal.run.
- You are running inside WorkBuddy with local tools. For opening websites, searching, clicking, typing, files, apps, or clipboard tasks, produce toolCalls instead of saying you cannot operate the computer.
- Mark sensitivity as "sensitive" for high or critical risk tools, file deletion/move/rename, sending messages, changing system settings, installing software, or anything irreversible.
- Do not create actions that steal credentials, bypass login, hide from the user, disable security tools, or exfiltrate private data.
- If the user asks to write content and does not provide exact text, generate useful content directly in the action text.
- For Word/WPS document tasks, prefer office.create_word with complete text instead of keyboard typing.
- Keep toolCalls reasonably small. Max 12 calls.`;

const AGENT_REVIEW_PROMPT = `You are WorkBuddy Agent Supervisor.

Return ONLY valid JSON. Do not use markdown.

You will receive the original user task, the last plan, and local execution results.
Decide whether the user's task is actually complete.

Return one of:
{"status":"complete","message":"brief completion message"}
{"status":"continue","message":"why another step is needed","title":"short title","summary":"next step summary","sensitivity":"normal|sensitive","steps":["visible steps"],"toolCalls":[{"tool":"tool.name","arguments":{},"reason":"why"}]}
{"status":"needs_user","message":"what the user must do manually"}
{"status":"failed","message":"why the task cannot be completed"}

Available tools:
__TOOLS__

Rules:
- Never mark complete just because actions were attempted. Mark complete only if the execution results show the intended outcome.
- Treat browser.open results as "the OS accepted an open request", not proof that the browser page loaded or that a search result is visible.
- If a tool failed, produce corrected toolCalls when possible; otherwise return needs_user or failed.
- Prefer specialized tools over terminal.run.
- Mark sensitivity as "sensitive" for high or critical risk tools, file deletion/move/rename, sending messages, changing system settings, installing software, or anything irreversible.
- Do not bypass logins, verification, permission prompts, or platform safety controls.
- Keep follow-up toolCalls small. Max 8 calls.`;

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
  const learningContext = buildLearningContext(config, text);
  const result = await callAgentModel(
    config,
    agentPrompt(AGENT_SYSTEM_PROMPT),
    buildPlanningUserMessage(text, history, learningContext),
  );
  return parseAgentTaskPlan(result.text, text);
}

export async function continueAgentTaskPlan(
  config: WorkBuddyConfig,
  plan: ComputerTaskPlan,
  observations: AgentActionObservation[],
  history: ChatMessage[],
): Promise<AgentContinuation> {
  const userTask = plan.agentTask?.userTask ?? plan.summary;
  const learningContext = buildLearningContext(config, userTask);
  const result = await callAgentModel(
    config,
    agentPrompt(AGENT_REVIEW_PROMPT),
    buildReviewUserMessage(userTask, plan, observations, history, learningContext),
  );
  return parseAgentContinuation(result.text, userTask, observations);
}

function agentPrompt(template: string): string {
  return template.replace("__TOOLS__", describeToolsForPrompt());
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

function buildPlanningUserMessage(text: string, history: ChatMessage[], learningContext: string): string {
  const context = history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return `Recent conversation:
${context || "(empty)"}

User task:
${text}

Controlled learning context (advisory only; current permissions always win):
${learningContext || "(empty)"}`;
}

function buildReviewUserMessage(
  userTask: string,
  plan: ComputerTaskPlan,
  observations: AgentActionObservation[],
  history: ChatMessage[],
  learningContext: string,
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
      controlledLearningContext: learningContext || "(empty)",
    },
    null,
    2,
  );
}

function parseAgentTaskPlan(text: string, userTask: string): ComputerTaskPlan | null {
  const payload = parseJsonPayload<AgentPlanPayload>(text);
  if (!payload || payload.intent !== "computer_task") return null;

  const actions = sanitizeToolCalls(payload.toolCalls ?? payload.actions ?? [], 12);
  if (!actions.length) return null;

  return {
    id: crypto.randomUUID(),
    title: normalizeText(payload.title, "Computer task"),
    summary: normalizeText(payload.summary, "Run a computer task"),
    sensitivity: inferPlanSensitivity(payload.sensitivity === "sensitive" ? "sensitive" : "normal", actions),
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
    const actions = sanitizeToolCalls(payload.toolCalls ?? payload.actions ?? [], 8);
    if (!actions.length) {
      return {
        status: "needs_user",
        message: normalizeText(payload.message, "还需要继续处理，但模型没有给出下一步动作。"),
      };
    }

    const sensitivity = inferPlanSensitivity(payload.sensitivity === "sensitive" ? "sensitive" : "normal", actions);
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

function sanitizeToolCalls(values: unknown[], maxActions: number): ComputerAction[] {
  const actions: ComputerAction[] = [];

  values.slice(0, maxActions).forEach((value) => {
    if (!value || typeof value !== "object") return;
    const raw = value as Record<string, unknown>;
    const tool = typeof raw.tool === "string" ? raw.tool : typeof raw.name === "string" ? raw.name : undefined;
    if (!tool || !getToolDefinition(tool)) return;
    const args = raw.arguments && typeof raw.arguments === "object" ? (raw.arguments as Record<string, unknown>) : {};
    const reason = typeof raw.reason === "string" ? raw.reason.slice(0, 240) : undefined;
    const call: AgentToolCall = {
      id: crypto.randomUUID(),
      tool,
      arguments: sanitizeArguments(args),
      reason,
    };
    actions.push({ type: "tool_call", call });
  });

  return actions;
}

function inferPlanSensitivity(base: TaskSensitivity, actions: ComputerAction[]): TaskSensitivity {
  if (base === "sensitive") return "sensitive";
  return actions.some((action) => {
    if (action.type === "tool_call") return riskToSensitivity(inferToolRisk(action.call)) === "sensitive";
    if (action.type === "shell_command" || action.type === "organize_folder") return true;
    if (action.type === "key" && action.key.toLowerCase() === "enter") return true;
    return false;
  })
    ? "sensitive"
    : "normal";
}

function sanitizeArguments(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => {
      if (typeof value === "string") return [key, value.slice(0, 20_000)];
      if (typeof value === "number" || typeof value === "boolean") return [key, value];
      if (Array.isArray(value)) return [key, value.filter((item) => typeof item === "string").slice(0, 20)];
      return [key, value];
    }),
  );
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : fallback;
}

function normalizeSteps(value: unknown[]): string[] {
  const steps = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8);
  return steps.length ? steps : ["Plan the task", "Run the approved actions"];
}
