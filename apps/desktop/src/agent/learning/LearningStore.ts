import type { WorkBuddyConfig } from "../../config/schema";
import { getToolDefinition, inferToolRisk } from "../tools/ToolRegistry";
import type { ToolDefinition, ToolRisk } from "../tools/ToolTypes";
import type {
  EvaluationCheck,
  LearnedSkill,
  LearningSnapshot,
  LearningState,
  LearningTaskRecord,
  LongTermMemory,
  SkillEvaluation,
  StoredToolStep,
  TaskExperience,
  TaskReflection,
} from "./LearningTypes";

const STATE_KEY = "workbuddy.agent.learningState.v1";
const SNAPSHOT_KEY = "workbuddy.agent.learningSnapshots.v1";
const LEARNING_EVENT = "workbuddy:learning";
const MAX_MEMORIES = 120;
const MAX_EXPERIENCES = 80;
const MAX_REFLECTIONS = 80;
const MAX_SKILLS = 40;
const MAX_SNAPSHOTS = 12;
const EVALUATOR_VERSION = 1;

const emptyState = (): LearningState => ({
  schemaVersion: 1,
  revision: 0,
  memories: [],
  experiences: [],
  reflections: [],
  skills: [],
  updatedAt: Date.now(),
});

export function learningEventName(): string {
  return LEARNING_EVENT;
}

export function loadLearningState(): LearningState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return emptyState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function loadLearningSnapshots(): LearningSnapshot[] {
  try {
    const value = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) ?? "[]");
    return Array.isArray(value) ? value.map(normalizeSnapshot).filter(Boolean) as LearningSnapshot[] : [];
  } catch {
    return [];
  }
}

export function captureExplicitPreference(config: WorkBuddyConfig, text: string): LongTermMemory | null {
  const learning = config.agent.selfImprovement;
  if (!learning.enabled || !learning.longTermMemory || !learning.autoLearnPreferences) return null;

  const statement = extractExplicitPreference(text);
  if (!statement) return null;

  let captured: LongTermMemory | null = null;
  mutateWithSnapshot("Learn explicit user preference", (state) => {
    const key = normalizePhrase(statement);
    const existing = state.memories.find((item) => normalizePhrase(item.statement) === key);
    if (existing) {
      existing.updatedAt = Date.now();
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.active = true;
      captured = existing;
      return;
    }

    captured = {
      id: crypto.randomUUID(),
      kind: "preference",
      statement,
      source: "explicit_user",
      confidence: 0.95,
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.memories = [...state.memories, captured].slice(-MAX_MEMORIES);
  });
  return captured;
}

export function recordLearningTask(config: WorkBuddyConfig, record: LearningTaskRecord): void {
  const learning = config.agent.selfImprovement;
  if (!learning.enabled || (!learning.experienceLibrary && !learning.reflection && !learning.skillGeneration)) {
    return;
  }

  mutateWithSnapshot(`Record task outcome: ${record.outcome}`, (state) => {
    const tools = extractStoredTools(record, false);
    const successfulTools = extractStoredTools(record, true);
    const experience = createExperience(record, tools);

    if (learning.experienceLibrary) {
      state.experiences = [...state.experiences, experience].slice(-MAX_EXPERIENCES);
    }

    if (learning.longTermMemory && record.outcome === "success") {
      learnCommonApplications(state, experience, successfulTools);
    }

    if (learning.reflection && record.outcome !== "success" && record.outcome !== "cancelled") {
      state.reflections = [...state.reflections, createReflection(record)].slice(-MAX_REFLECTIONS);
    }

    if (learning.skillGeneration && record.outcome === "success" && successfulTools.length) {
      const candidate = createSkillCandidate(experience, successfulTools, Boolean(learning.autoEvaluation));
      const fingerprint = skillFingerprint(candidate);
      const duplicate = state.skills.find((item) => skillFingerprint(item) === fingerprint);
      if (!duplicate) {
        state.skills = [...state.skills, candidate].slice(-MAX_SKILLS);
      } else {
        const current = duplicate.versions.find(
          (item) => item.version === (duplicate.pendingVersion ?? duplicate.activeVersion),
        );
        if (JSON.stringify(current?.steps ?? []) !== JSON.stringify(successfulTools)) {
          const nextVersion = Math.max(...duplicate.versions.map((item) => item.version), 0) + 1;
          duplicate.versions.push({
            version: nextVersion,
            createdAt: Date.now(),
            steps: successfulTools,
            evaluation: Boolean(learning.autoEvaluation) ? evaluateSkill(successfulTools) : unevaluatedSkill(),
          });
          duplicate.versions = trimSkillVersions(
            duplicate.versions,
            duplicate.activeVersion,
            duplicate.pendingVersion ?? nextVersion,
          );
          const nextEvaluation = duplicate.versions.find((item) => item.version === nextVersion)?.evaluation;
          if (nextEvaluation?.passed) {
            duplicate.pendingVersion = nextVersion;
            if (duplicate.status !== "approved") duplicate.status = "candidate";
          }
          duplicate.triggerPhrases = [...new Set([...duplicate.triggerPhrases, experience.userTask])].slice(-8);
          duplicate.updatedAt = Date.now();
        }
      }
    }
  });
}

export function approveLearnedSkill(id: string): { ok: boolean; message: string } {
  const state = loadLearningState();
  const skill = state.skills.find((item) => item.id === id);
  if (!skill) return { ok: false, message: "Skill not found." };
  const versionNumber = skill.pendingVersion ?? skill.activeVersion;
  const version = skill.versions.find((item) => item.version === versionNumber);
  if (!version?.evaluation.passed) return { ok: false, message: "The skill must pass evaluation before approval." };

  mutateWithSnapshot(`Approve skill: ${skill.name}`, (next) => {
    const target = next.skills.find((item) => item.id === id);
    if (target) {
      target.activeVersion = target.pendingVersion ?? target.activeVersion;
      target.pendingVersion = undefined;
      target.status = "approved";
      target.updatedAt = Date.now();
    }
  });
  return { ok: true, message: "Skill approved." };
}

export function rejectLearnedSkill(id: string): void {
  const skill = loadLearningState().skills.find((item) => item.id === id);
  if (!skill) return;
  mutateWithSnapshot(`Reject skill: ${skill.name}`, (state) => {
    const target = state.skills.find((item) => item.id === id);
    if (target) {
      if (target.status === "approved" && target.pendingVersion) {
        target.pendingVersion = undefined;
      } else {
        target.status = "rejected";
      }
      target.updatedAt = Date.now();
    }
  });
}

export function reevaluateLearnedSkill(id: string): void {
  const skill = loadLearningState().skills.find((item) => item.id === id);
  if (!skill) return;
  mutateWithSnapshot(`Re-evaluate skill: ${skill.name}`, (state) => {
    const target = state.skills.find((item) => item.id === id);
    const versionNumber = target?.pendingVersion ?? target?.activeVersion;
    const version = target?.versions.find((item) => item.version === versionNumber);
    if (!target || !version) return;
    version.evaluation = evaluateSkill(version.steps);
    if (!version.evaluation.passed && target.status === "approved" && target.pendingVersion) {
      target.pendingVersion = undefined;
    } else if (!version.evaluation.passed && target.status === "approved") {
      target.status = "candidate";
    }
    target.updatedAt = Date.now();
  });
}

export function setMemoryActive(id: string, active: boolean): void {
  const memory = loadLearningState().memories.find((item) => item.id === id);
  if (!memory || memory.active === active) return;
  mutateWithSnapshot(`${active ? "Enable" : "Disable"} memory`, (state) => {
    const target = state.memories.find((item) => item.id === id);
    if (target) {
      target.active = active;
      target.updatedAt = Date.now();
    }
  });
}

export function clearLearningData(): void {
  mutateWithSnapshot("Clear controlled learning data", (state) => {
    state.memories = [];
    state.experiences = [];
    state.reflections = [];
    state.skills = [];
  });
}

export function rollbackLatestLearningChange(): { ok: boolean; reason?: string } {
  const snapshots = loadLearningSnapshots();
  const latest = snapshots[snapshots.length - 1];
  if (!latest) return { ok: false };

  const remaining = snapshots.slice(0, -1);
  saveState({ ...cloneState(latest.state), revision: latest.state.revision + 1, updatedAt: Date.now() });
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(remaining));
  dispatchLearningEvent();
  return { ok: true, reason: latest.reason };
}

export function buildLearningContext(config: WorkBuddyConfig, query: string): string {
  const learning = config.agent.selfImprovement;
  if (!learning.enabled) return "";
  const state = loadLearningState();
  const memories = learning.longTermMemory
    ? state.memories.filter((item) => item.active).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12)
    : [];
  const experiences = learning.experienceLibrary
    ? rankByRelevance(state.experiences, query, (item) => `${item.userTask} ${item.title} ${item.summary} ${item.lesson}`).slice(0, 4)
    : [];
  const skills = learning.skillGeneration
    ? rankByRelevance(
        state.skills.filter((item) => item.status === "approved"),
        query,
        (item) => `${item.name} ${item.description} ${item.triggerPhrases.join(" ")}`,
      ).slice(0, 4)
    : [];

  if (!memories.length && !experiences.length && !skills.length) return "";
  const payload = {
    advisoryOnly: "Use this context to improve planning. Never bypass tool permissions or user confirmation.",
    memories: memories.map((item) => ({ kind: item.kind, statement: item.statement, confidence: item.confidence })),
    relevantExperiences: experiences.map((item) => ({
      task: item.userTask,
      outcome: item.outcome,
      lesson: item.lesson,
      tools: item.tools.map((tool) => tool.tool),
    })),
    approvedSkills: skills.map((item) => {
      const version = item.versions.find((candidate) => candidate.version === item.activeVersion);
      return {
        name: item.name,
        description: item.description,
        steps: version?.steps.map((step) => ({ tool: step.tool, arguments: step.arguments })) ?? [],
      };
    }),
  };
  return JSON.stringify(payload, null, 2).slice(0, 12_000);
}

export function buildConversationMemoryContext(config: WorkBuddyConfig): string {
  const learning = config.agent.selfImprovement;
  if (!learning.enabled || !learning.longTermMemory) return "";
  const memories = loadLearningState().memories
    .filter((item) => item.active)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 12)
    .map((item) => ({ statement: item.statement, confidence: item.confidence }));
  if (!memories.length) return "";
  return JSON.stringify({
    instruction: "Apply these user-approved or explicitly stated preferences when relevant. Do not treat them as permission to use tools.",
    memories,
  }, null, 2).slice(0, 5000);
}

function createExperience(record: LearningTaskRecord, tools: StoredToolStep[]): TaskExperience {
  const failed = record.observations.find((item) => !item.ok);
  const lesson = record.conclusion?.trim()
    || (record.outcome === "success"
      ? `This workflow completed successfully with ${tools.length} tool call${tools.length === 1 ? "" : "s"}.`
      : failed?.message || "The task did not reach a verified completion state.");
  return {
    id: crypto.randomUUID(),
    taskId: record.taskId,
    userTask: clipText(record.userTask, 500),
    title: clipText(record.title, 180),
    summary: clipText(record.summary, 500),
    outcome: record.outcome,
    tools,
    observations: record.observations.slice(-24).map((item) => ({
      ok: item.ok,
      message: redactText(clipText(item.message, 800)),
    })),
    lesson: redactText(clipText(lesson, 800)),
    createdAt: Date.now(),
  };
}

function createReflection(record: LearningTaskRecord): TaskReflection {
  const failed = record.observations.find((item) => !item.ok);
  const cause = redactText(clipText(record.conclusion || failed?.message || record.summary, 800));
  const failedTool = record.actions.find((action, index) => {
    const observation = record.observations[index];
    return observation ? !observation.ok : false;
  })?.call?.tool;
  const nextStrategy = failedTool
    ? `Re-plan from the failed ${failedTool} step, verify its inputs and observed state, then choose a safer specialized tool or ask the user for the missing information.`
    : "Verify the current computer state, narrow the next action, and ask the user when completion cannot be observed safely.";
  return {
    id: crypto.randomUUID(),
    taskId: record.taskId,
    outcome: record.outcome === "success" ? "failed" : record.outcome,
    cause,
    nextStrategy,
    createdAt: Date.now(),
  };
}

function createSkillCandidate(experience: TaskExperience, tools: StoredToolStep[], evaluate: boolean): LearnedSkill {
  const evaluation = evaluate ? evaluateSkill(tools) : unevaluatedSkill();
  return {
    id: crypto.randomUUID(),
    name: clipText(experience.title || experience.userTask, 80),
    description: clipText(`Reusable workflow learned from: ${experience.userTask}`, 240),
    triggerPhrases: [clipText(experience.userTask, 160)],
    status: "candidate",
    sourceExperienceId: experience.id,
    activeVersion: 1,
    pendingVersion: 1,
    versions: [{ version: 1, createdAt: Date.now(), steps: tools, evaluation }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function extractStoredTools(record: LearningTaskRecord, successfulOnly: boolean): StoredToolStep[] {
  return record.actions.flatMap((action, index) => {
    if (successfulOnly && !record.observations[index]?.ok) return [];
    const call = action.type === "tool_call" ? action.call : undefined;
    if (!call || !getToolDefinition(call.tool)) return [];
    const definition = getToolDefinition(call.tool)!;
    return [{
      tool: call.tool,
      arguments: sanitizeArguments(call.arguments),
      risk: inferToolRisk({ id: "learning", tool: call.tool, arguments: call.arguments }),
      permissions: [...definition.permissions],
    }];
  }).slice(0, 12);
}

function learnCommonApplications(state: LearningState, experience: TaskExperience, tools: StoredToolStep[]): void {
  const applications = tools.flatMap((step) => {
    if (step.tool === "app.open" && typeof step.arguments.app === "string") return [step.arguments.app];
    if (step.tool === "office.create_word" && typeof step.arguments.app === "string") return [step.arguments.app];
    return [];
  });

  [...new Set(applications)].forEach((application) => {
    const previousUses = state.experiences.filter((item) =>
      item.outcome === "success" && item.id !== experience.id && item.tools.some((tool) =>
        (tool.tool === "app.open" || tool.tool === "office.create_word") && tool.arguments.app === application,
      ),
    ).length;
    const useCount = previousUses + 1;
    if (useCount < 3) return;

    const statement = `Frequently used application: ${application}`;
    const existing = state.memories.find((item) => item.kind === "application" && item.statement === statement);
    if (existing) {
      existing.confidence = Math.min(0.9, 0.6 + useCount * 0.05);
      existing.updatedAt = Date.now();
      existing.active = true;
      return;
    }

    const memory: LongTermMemory = {
      id: crypto.randomUUID(),
      kind: "application",
      statement,
      source: "task_experience",
      confidence: Math.min(0.9, 0.6 + useCount * 0.05),
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.memories = [...state.memories, memory].slice(-MAX_MEMORIES);
  });
}

function evaluateSkill(steps: StoredToolStep[]): SkillEvaluation {
  const checks: EvaluationCheck[] = [];
  checks.push(check("step-count", steps.length > 0 && steps.length <= 12, "Workflow contains 1 to 12 bounded steps."));

  const unknown = steps.filter((step) => !getToolDefinition(step.tool)).map((step) => step.tool);
  checks.push(check("known-tools", unknown.length === 0, unknown.length ? `Unknown tools: ${unknown.join(", ")}` : "Every tool exists in the registry."));

  const invalidArguments = steps.flatMap((step) => validateArguments(getToolDefinition(step.tool), step.arguments).map((message) => `${step.tool}: ${message}`));
  checks.push(check("schema", invalidArguments.length === 0, invalidArguments.length ? invalidArguments.join("; ") : "Arguments satisfy required schema fields."));

  const serialized = JSON.stringify(steps);
  const containsSecret = /(?:api[_-]?key|access[_-]?token|password|secret)\s*["']?\s*[:=]/i.test(serialized)
    || /\b(?:sk|ghp|github_pat)-?[A-Za-z0-9_\-]{16,}\b/.test(serialized);
  checks.push(check("secret-scan", !containsSecret, containsSecret ? "Possible credential material was found." : "No credential-like values were found."));

  const critical = steps.filter((step) => step.risk === "critical").map((step) => step.tool);
  checks.push(check("critical-risk", critical.length === 0, critical.length ? `Critical tools cannot become learned skills: ${critical.join(", ")}` : "No critical-risk tools are included."));

  const dangerousTerminal = steps.some((step) => step.tool === "terminal.run" && isDangerousCommand(String(step.arguments.command ?? "")));
  checks.push(check("terminal-policy", !dangerousTerminal, dangerousTerminal ? "The terminal command violates the learned-skill safety policy." : "Terminal commands passed static safety checks."));

  const metadataMismatch = steps.filter((step) => {
    const definition = getToolDefinition(step.tool);
    if (!definition) return true;
    const expectedPermissions = [...definition.permissions].sort().join("|");
    const storedPermissions = [...step.permissions].sort().join("|");
    return definition.risk !== step.risk || expectedPermissions !== storedPermissions;
  }).map((step) => step.tool);
  checks.push(check(
    "sandbox-dry-run",
    metadataMismatch.length === 0,
    metadataMismatch.length
      ? `Dry-run rejected mismatched risk or permission metadata: ${metadataMismatch.join(", ")}`
      : "No-side-effect dry-run resolved every step with matching risk and permissions.",
  ));

  const passed = checks.every((item) => item.passed);
  const riskPenalty = steps.reduce((total, step) => total + riskWeight(step.risk), 0);
  return {
    evaluatorVersion: EVALUATOR_VERSION,
    passed,
    score: passed ? Math.max(1, 100 - riskPenalty) : 0,
    evaluatedAt: Date.now(),
    checks,
  };
}

function unevaluatedSkill(): SkillEvaluation {
  return {
    evaluatorVersion: EVALUATOR_VERSION,
    passed: false,
    score: 0,
    evaluatedAt: Date.now(),
    checks: [check("evaluation-disabled", false, "Automatic evaluation is disabled. Run evaluation manually before approval.")],
  };
}

function validateArguments(definition: ToolDefinition | undefined, args: Record<string, unknown>): string[] {
  if (!definition) return ["unknown tool"];
  const errors: string[] = [];
  for (const required of definition.inputSchema.required ?? []) {
    if (!(required in args) || args[required] === "" || args[required] === undefined || args[required] === null) {
      errors.push(`missing '${required}'`);
    }
  }
  if (definition.inputSchema.additionalProperties === false) {
    const allowed = new Set(Object.keys(definition.inputSchema.properties ?? {}));
    const extras = Object.keys(args).filter((key) => !allowed.has(key));
    if (extras.length) errors.push(`unexpected fields ${extras.join(", ")}`);
  }
  return errors;
}

function isDangerousCommand(command: string): boolean {
  return /(?:format\s+[a-z]:|diskpart|bcdedit|vssadmin\s+delete|remove-item\s+[^\r\n]*(?:-recurse|-force)|del\s+\/s|rd\s+\/s|shutdown\s|reg\s+delete|set-mppreference|disable-windowsoptionalfeature)/i.test(command);
}

function mutateWithSnapshot(reason: string, mutate: (state: LearningState) => void): void {
  const current = loadLearningState();
  appendSnapshot(reason, current);
  const next = cloneState(current);
  mutate(next);
  next.revision = current.revision + 1;
  next.updatedAt = Date.now();
  saveState(next);
  dispatchLearningEvent();
}

function appendSnapshot(reason: string, state: LearningState): void {
  const snapshots = loadLearningSnapshots();
  snapshots.push({ id: crypto.randomUUID(), reason, createdAt: Date.now(), state: cloneState(state) });
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
}

function saveState(state: LearningState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(normalizeState(state)));
}

function dispatchLearningEvent(): void {
  window.dispatchEvent(new Event(LEARNING_EVENT));
}

function normalizeState(value: unknown): LearningState {
  if (!value || typeof value !== "object") return emptyState();
  const raw = value as Partial<LearningState>;
  return {
    schemaVersion: 1,
    revision: Number.isFinite(raw.revision) ? Number(raw.revision) : 0,
    memories: Array.isArray(raw.memories) ? raw.memories.slice(-MAX_MEMORIES) : [],
    experiences: Array.isArray(raw.experiences) ? raw.experiences.slice(-MAX_EXPERIENCES) : [],
    reflections: Array.isArray(raw.reflections) ? raw.reflections.slice(-MAX_REFLECTIONS) : [],
    skills: Array.isArray(raw.skills) ? raw.skills.slice(-MAX_SKILLS) : [],
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : Date.now(),
  };
}

function normalizeSnapshot(value: unknown): LearningSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<LearningSnapshot>;
  if (typeof raw.id !== "string" || typeof raw.reason !== "string" || !raw.state) return null;
  return {
    id: raw.id,
    reason: raw.reason,
    createdAt: Number(raw.createdAt) || Date.now(),
    state: normalizeState(raw.state),
  };
}

function cloneState(state: LearningState): LearningState {
  return JSON.parse(JSON.stringify(state)) as LearningState;
}

function extractExplicitPreference(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length < 4 || normalized.length > 500) return null;
  const patterns = [
    /(?:请记住|记住|我的偏好是|我(?:更)?(?:喜欢|习惯|偏好)|以后(?:请|都|默认)?|默认(?:请|用)?|不要再)\s*[:：,，]?\s*(.{2,220})$/i,
    /(?:please remember|remember that|my preference is|i prefer|i like|from now on|always use|do not use|never use)\s*[:;,]?\s*(.{2,220})$/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return clipText(normalized, 220);
  }
  return null;
}

function rankByRelevance<T>(items: T[], query: string, text: (item: T) => string): T[] {
  const queryTerms = termSet(query);
  return items
    .map((item, index) => ({ item, index, score: overlapScore(queryTerms, termSet(text(item))) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .filter((item, index) => item.score > 0 || index < 2)
    .map((item) => item.item);
}

function termSet(value: string): Set<string> {
  const normalized = value.toLocaleLowerCase();
  const terms = new Set(normalized.match(/[a-z0-9_\-.]{2,}|[\p{Script=Han}]{2,}/gu) ?? []);
  for (const chunk of normalized.match(/[\p{Script=Han}]{3,}/gu) ?? []) {
    for (let index = 0; index < chunk.length - 1; index += 1) terms.add(chunk.slice(index, index + 2));
  }
  return terms;
}

function overlapScore(left: Set<string>, right: Set<string>): number {
  let score = 0;
  left.forEach((term) => { if (right.has(term)) score += term.length; });
  return score;
}

function sanitizeArguments(args: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  Object.entries(args).forEach(([key, value]) => {
    if (/(?:api.?key|token|password|secret|authorization)/i.test(key)) return;
    if (typeof value === "string") sanitized[key] = redactText(clipText(value, 4000));
    else if (typeof value === "number" || typeof value === "boolean") sanitized[key] = value;
    else if (Array.isArray(value)) {
      sanitized[key] = value.filter((item): item is string => typeof item === "string").slice(0, 20);
    }
  });
  return sanitized;
}

function redactText(value: string): string {
  return value
    .replace(/\b(?:sk|ghp|github_pat)-?[A-Za-z0-9_\-]{16,}\b/g, "[REDACTED_TOKEN]")
    .replace(/((?:api[_-]?key|access[_-]?token|password|secret)\s*["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, "$1[REDACTED]");
}

function skillFingerprint(skill: LearnedSkill): string {
  const version = skill.versions.find((item) => item.version === skill.activeVersion);
  return (version?.steps.map((item) => item.tool).join(">") ?? "") + `:${normalizePhrase(skill.name)}`;
}

function normalizePhrase(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function check(id: string, passed: boolean, message: string): EvaluationCheck {
  return { id, passed, message };
}

function riskWeight(risk: ToolRisk): number {
  if (risk === "critical") return 40;
  if (risk === "high") return 15;
  if (risk === "medium") return 4;
  return 1;
}

function trimSkillVersions(
  versions: LearnedSkill["versions"],
  activeVersion: number,
  pendingVersion?: number,
): LearnedSkill["versions"] {
  const required = new Set([activeVersion, pendingVersion].filter((item): item is number => typeof item === "number"));
  const recent = [...versions].sort((a, b) => b.version - a.version).slice(0, 8);
  const retained = [...recent, ...versions.filter((item) => required.has(item.version))];
  return [...new Map(retained.map((item) => [item.version, item])).values()]
    .sort((a, b) => a.version - b.version)
    .slice(-10);
}

function clipText(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
