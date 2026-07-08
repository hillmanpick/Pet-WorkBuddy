import type { AgentToolCall, AuditLogEntry, ToolDefinition, ToolExecutionResult } from "./ToolTypes";

const AUDIT_LOG_KEY = "workbuddy.agent.auditLog";
const AUDIT_LOG_EVENT = "workbuddy:auditlog";
const MAX_AUDIT_ENTRIES = 500;

export function loadAuditLog(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? (JSON.parse(raw) as AuditLogEntry[]) : [];
  } catch {
    return [];
  }
}

export function appendAuditLog(entry: AuditLogEntry): void {
  const next = [...loadAuditLog(), entry].slice(-MAX_AUDIT_ENTRIES);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(AUDIT_LOG_EVENT));
}

export function clearAuditLog(): void {
  localStorage.removeItem(AUDIT_LOG_KEY);
  window.dispatchEvent(new Event(AUDIT_LOG_EVENT));
}

export function auditLogEventName(): string {
  return AUDIT_LOG_EVENT;
}

export function createAuditEntry(input: {
  taskId: string;
  call: AgentToolCall;
  definition: ToolDefinition;
  approved: boolean;
  startedAt: number;
  endedAt: number;
  result: ToolExecutionResult;
}): AuditLogEntry {
  return {
    id: crypto.randomUUID(),
    taskId: input.taskId,
    tool: input.call.tool,
    risk: input.definition.risk,
    permissions: input.definition.permissions,
    argumentsPreview: previewArguments(input.call.arguments),
    approved: input.approved,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    ok: input.result.ok,
    message: input.result.message,
  };
}

function previewArguments(value: Record<string, unknown>): unknown {
  const json = JSON.stringify(value);
  if (json.length <= 1000) return value;
  return `${json.slice(0, 1000)}...`;
}
