export type ToolRisk = "low" | "medium" | "high" | "critical";

export type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDefinition = {
  name: string;
  description: string;
  risk: ToolRisk;
  permissions: string[];
  inputSchema: JsonSchema;
};

export type ToolPluginManifest = {
  id: string;
  name: string;
  permissions: string[];
  tools: ToolDefinition[];
};

export type AgentToolCall = {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  reason?: string;
};

export type ToolExecutionResult = {
  ok: boolean;
  message: string;
  data?: unknown;
};

export type ToolExecutor = (call: AgentToolCall) => Promise<ToolExecutionResult>;

export type ToolRuntime = {
  manifests: ToolPluginManifest[];
  execute: ToolExecutor;
};

export type AuditLogEntry = {
  id: string;
  taskId: string;
  tool: string;
  risk: ToolRisk;
  permissions: string[];
  argumentsPreview: unknown;
  approved: boolean;
  startedAt: number;
  endedAt: number;
  ok: boolean;
  message: string;
};
