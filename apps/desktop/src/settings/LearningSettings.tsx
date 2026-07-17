import { Check, RefreshCw, RotateCcw, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  approveLearnedSkill,
  clearLearningData,
  learningEventName,
  loadLearningSnapshots,
  loadLearningState,
  reevaluateLearnedSkill,
  rejectLearnedSkill,
  rollbackLatestLearningChange,
  setMemoryActive,
} from "../agent/learning/LearningStore";
import type { LearnedSkill, LearningSnapshot, LearningState } from "../agent/learning/LearningTypes";
import type { WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";

type LearningSettingsProps = {
  config: WorkBuddyConfig;
  labels: Translations["agent"];
  onConfigChange: (config: WorkBuddyConfig) => void;
};

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function LearningSettings({ config, labels, onConfigChange }: LearningSettingsProps) {
  const [state, setState] = useState<LearningState>(() => loadLearningState());
  const [snapshots, setSnapshots] = useState<LearningSnapshot[]>(() => loadLearningSnapshots());
  const [notice, setNotice] = useState<string | null>(null);
  const learning = config.agent.selfImprovement;
  const snapshotCount = snapshots.length;

  const skills = useMemo(
    () => [...state.skills].sort((a, b) => skillOrder(a) - skillOrder(b) || b.updatedAt - a.updatedAt),
    [state.skills],
  );

  useEffect(() => {
    const refresh = () => {
      setState(loadLearningState());
      setSnapshots(loadLearningSnapshots());
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(learningEventName(), refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(learningEventName(), refresh);
    };
  }, []);

  function updateLearning(value: Partial<WorkBuddyConfig["agent"]["selfImprovement"]>) {
    onConfigChange({
      ...config,
      agent: {
        ...config.agent,
        selfImprovement: { ...learning, ...value },
      },
    });
  }

  function refresh() {
    setState(loadLearningState());
    setSnapshots(loadLearningSnapshots());
    setNotice(null);
  }

  function approve(skill: LearnedSkill) {
    const version = skill.versions.find((item) => item.version === (skill.pendingVersion ?? skill.activeVersion));
    const highestRisk = highestSkillRisk(skill);
    const prompt = `${labels.approveSkillConfirm}\n\n${skill.name}\n${labels.risk}: ${highestRisk}\n${labels.evaluationScore}: ${version?.evaluation.score ?? 0}`;
    if (!window.confirm(prompt)) return;
    const result = approveLearnedSkill(skill.id);
    setNotice(result.ok ? labels.skillApproved : result.message);
    refreshStateOnly();
  }

  function reject(skill: LearnedSkill) {
    rejectLearnedSkill(skill.id);
    setNotice(labels.skillRejected);
    refreshStateOnly();
  }

  function rollback() {
    if (!snapshotCount || !window.confirm(labels.rollbackConfirm)) return;
    const result = rollbackLatestLearningChange();
    setNotice(result.ok ? `${labels.rollbackDone}: ${result.reason ?? ""}` : labels.noSnapshots);
    refreshStateOnly();
  }

  function clearAll() {
    if (!window.confirm(labels.clearLearningConfirm)) return;
    clearLearningData();
    setNotice(labels.learningCleared);
    refreshStateOnly();
  }

  function refreshStateOnly() {
    setState(loadLearningState());
    setSnapshots(loadLearningSnapshots());
  }

  return (
    <>
      <section className="settings-group learning-settings">
        <header>
          <span>
            <h3>{labels.controlledLearning}</h3>
            <small>{labels.revision} {state.revision}</small>
          </span>
          <span className="settings-icon-row">
            <button type="button" title={labels.refresh} onClick={refresh}>
              <RefreshCw size={15} />
            </button>
            <button type="button" title={labels.rollback} disabled={!snapshotCount} onClick={rollback}>
              <RotateCcw size={15} />
            </button>
            <button type="button" title={labels.clearLearning} onClick={clearAll}>
              <Trash2 size={15} />
            </button>
          </span>
        </header>

        <label className="toggle-field learning-master-toggle">
          <input
            type="checkbox"
            checked={learning.enabled}
            onChange={(event) => updateLearning({ enabled: event.target.checked })}
          />
          <span>{labels.learningEnabled}</span>
        </label>

        <div className="learning-toggle-grid">
          <LearningToggle label={labels.longTermMemory} checked={learning.longTermMemory} onChange={(value) => updateLearning({ longTermMemory: value })} />
          <LearningToggle label={labels.experienceLibrary} checked={learning.experienceLibrary} onChange={(value) => updateLearning({ experienceLibrary: value })} />
          <LearningToggle label={labels.taskReflection} checked={learning.reflection} onChange={(value) => updateLearning({ reflection: value })} />
          <LearningToggle label={labels.skillGeneration} checked={learning.skillGeneration} onChange={(value) => updateLearning({ skillGeneration: value })} />
          <LearningToggle label={labels.autoEvaluation} checked={learning.autoEvaluation} onChange={(value) => updateLearning({ autoEvaluation: value })} />
          <LearningToggle label={labels.autoLearnPreferences} checked={learning.autoLearnPreferences} onChange={(value) => updateLearning({ autoLearnPreferences: value })} />
        </div>

        <div className="learning-stats">
          <span><strong>{state.memories.length}</strong>{labels.memories}</span>
          <span><strong>{state.experiences.length}</strong>{labels.experiences}</span>
          <span><strong>{state.reflections.length}</strong>{labels.reflections}</span>
          <span><strong>{state.skills.length}</strong>{labels.learnedSkills}</span>
          <span><strong>{snapshotCount}</strong>{labels.snapshots}</span>
        </div>
        {snapshots.length ? (
          <details className="learning-snapshot-history">
            <summary>{labels.changeHistory}</summary>
            <ol>
              {[...snapshots].reverse().map((snapshot) => (
                <li key={snapshot.id}>
                  <span>{snapshot.reason}</span>
                  <time dateTime={new Date(snapshot.createdAt).toISOString()}>{formatDateTime(snapshot.createdAt)}</time>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
        {notice ? <p className="settings-note">{notice}</p> : null}
      </section>

      <section className="settings-group">
        <h3>{labels.memories}</h3>
        {state.memories.length ? (
          <div className="learning-list">
            {[...state.memories].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20).map((memory) => (
              <article className="learning-row" key={memory.id}>
                <label className="learning-memory-toggle">
                  <input type="checkbox" checked={memory.active} onChange={(event) => setMemoryActive(memory.id, event.target.checked)} />
                  <span>{memory.statement}</span>
                </label>
                <small>{memory.kind} · {Math.round(memory.confidence * 100)}% · {formatDateTime(memory.updatedAt)}</small>
              </article>
            ))}
          </div>
        ) : <p className="settings-help">{labels.noMemories}</p>}
      </section>

      <section className="settings-group">
        <h3>{labels.learnedSkills}</h3>
        {skills.length ? (
          <div className="learning-list">
            {skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} labels={labels} onApprove={() => approve(skill)} onReject={() => reject(skill)} onEvaluate={() => { reevaluateLearnedSkill(skill.id); refreshStateOnly(); }} />
            ))}
          </div>
        ) : <p className="settings-help">{labels.noSkills}</p>}
      </section>

      <section className="settings-group">
        <h3>{labels.experiences}</h3>
        {state.experiences.length ? (
          <div className="learning-list">
            {[...state.experiences].reverse().slice(0, 16).map((experience) => (
              <article className="learning-row" key={experience.id}>
                <header>
                  <strong>{experience.title}</strong>
                  <span className={`learning-outcome ${experience.outcome}`}>{labels[experience.outcome]}</span>
                </header>
                <p>{experience.lesson}</p>
                <small>{experience.tools.map((tool) => tool.tool).join(" → ") || labels.noToolCalls} · {formatDateTime(experience.createdAt)}</small>
              </article>
            ))}
          </div>
        ) : <p className="settings-help">{labels.noExperiences}</p>}
      </section>

      <section className="settings-group">
        <h3>{labels.reflections}</h3>
        {state.reflections.length ? (
          <div className="learning-list">
            {[...state.reflections].reverse().slice(0, 16).map((reflection) => (
              <article className="learning-row" key={reflection.id}>
                <p>{reflection.cause}</p>
                <small>{reflection.nextStrategy}</small>
                <time dateTime={new Date(reflection.createdAt).toISOString()}>{formatDateTime(reflection.createdAt)}</time>
              </article>
            ))}
          </div>
        ) : <p className="settings-help">{labels.noReflections}</p>}
      </section>
    </>
  );
}

function LearningToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="toggle-field compact-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function SkillRow({
  skill,
  labels,
  onApprove,
  onReject,
  onEvaluate,
}: {
  skill: LearnedSkill;
  labels: Translations["agent"];
  onApprove: () => void;
  onReject: () => void;
  onEvaluate: () => void;
}) {
  const displayedVersion = skill.pendingVersion ?? skill.activeVersion;
  const version = skill.versions.find((item) => item.version === displayedVersion);
  const evaluation = version?.evaluation;
  return (
    <article className="learning-row skill-row">
      <header>
        <span>
          <strong>{skill.name}</strong>
          <small>
            v{displayedVersion} · {labels[skill.status]}
            {skill.pendingVersion ? ` · ${labels.pendingUpdate}` : ""} · {labels.risk}: {highestSkillRisk(skill)}
          </small>
        </span>
        <span className="settings-icon-row">
          <button type="button" title={labels.reevaluate} onClick={onEvaluate}><RefreshCw size={14} /></button>
          {skill.status !== "approved" || skill.pendingVersion ? <button type="button" title={labels.approve} disabled={!evaluation?.passed} onClick={onApprove}><Check size={14} /></button> : null}
          {skill.status !== "rejected" ? <button type="button" title={labels.reject} onClick={onReject}><X size={14} /></button> : null}
        </span>
      </header>
      <p>{skill.description}</p>
      <div className="agent-tool-list">
        {version?.steps.map((step, index) => <span className={`risk-pill risk-${step.risk}`} key={`${step.tool}-${index}`}>{step.tool}</span>)}
      </div>
      <details>
        <summary><ShieldCheck size={13} /> {labels.evaluationScore}: {evaluation?.score ?? 0}</summary>
        <ul className="evaluation-checks">
          {evaluation?.checks.map((item) => <li className={item.passed ? "passed" : "failed"} key={item.id}>{item.passed ? "✓" : "×"} {item.message}</li>)}
        </ul>
      </details>
    </article>
  );
}

function skillOrder(skill: LearnedSkill): number {
  if (skill.status === "candidate") return 0;
  if (skill.status === "approved") return 1;
  return 2;
}

function highestSkillRisk(skill: LearnedSkill): string {
  const order = { low: 0, medium: 1, high: 2, critical: 3 } as const;
  const version = skill.versions.find((item) => item.version === (skill.pendingVersion ?? skill.activeVersion));
  return version?.steps.reduce((highest, step) => order[step.risk] > order[highest] ? step.risk : highest, "low" as keyof typeof order) ?? "low";
}
