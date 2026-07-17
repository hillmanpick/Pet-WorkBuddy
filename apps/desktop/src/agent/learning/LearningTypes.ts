import type { ToolRisk } from "../tools/ToolTypes";

export type LearningOutcome = "success" | "failed" | "needs_user" | "cancelled";
export type MemoryKind = "preference" | "application" | "workflow";
export type LearnedSkillStatus = "candidate" | "approved" | "rejected" | "retired";

export type LongTermMemory = {
  id: string;
  kind: MemoryKind;
  statement: string;
  source: "explicit_user" | "task_experience";
  confidence: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

export type StoredToolStep = {
  tool: string;
  arguments: Record<string, unknown>;
  risk: ToolRisk;
  permissions: string[];
};

export type TaskExperience = {
  id: string;
  taskId: string;
  userTask: string;
  title: string;
  summary: string;
  outcome: LearningOutcome;
  tools: StoredToolStep[];
  observations: Array<{ ok: boolean; message: string }>;
  lesson: string;
  createdAt: number;
};

export type TaskReflection = {
  id: string;
  taskId: string;
  outcome: Exclude<LearningOutcome, "success">;
  cause: string;
  nextStrategy: string;
  createdAt: number;
};

export type EvaluationCheck = {
  id: string;
  passed: boolean;
  message: string;
};

export type SkillEvaluation = {
  evaluatorVersion: number;
  passed: boolean;
  score: number;
  evaluatedAt: number;
  checks: EvaluationCheck[];
};

export type LearnedSkillVersion = {
  version: number;
  createdAt: number;
  steps: StoredToolStep[];
  evaluation: SkillEvaluation;
};

export type LearnedSkill = {
  id: string;
  name: string;
  description: string;
  triggerPhrases: string[];
  status: LearnedSkillStatus;
  sourceExperienceId: string;
  activeVersion: number;
  pendingVersion?: number;
  versions: LearnedSkillVersion[];
  createdAt: number;
  updatedAt: number;
};

export type LearningState = {
  schemaVersion: 1;
  revision: number;
  memories: LongTermMemory[];
  experiences: TaskExperience[];
  reflections: TaskReflection[];
  skills: LearnedSkill[];
  updatedAt: number;
};

export type LearningSnapshot = {
  id: string;
  reason: string;
  createdAt: number;
  state: LearningState;
};

export type LearningTaskObservation = {
  ok: boolean;
  message: string;
};

export type LearningTaskRecord = {
  taskId: string;
  userTask: string;
  title: string;
  summary: string;
  outcome: LearningOutcome;
  actions: Array<{
    type: string;
    call?: {
      tool: string;
      arguments: Record<string, unknown>;
    };
  }>;
  observations: LearningTaskObservation[];
  conclusion?: string;
};
