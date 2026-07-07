import { Check, Send, ShieldCheck, X } from "lucide-react";
import type { ComputerTaskPlan } from "../computer/ComputerTask";
import type { Translations } from "../i18n";

export type ComputerTaskPhase = "prepare" | "final";

type ComputerTaskPanelProps = {
  plan: ComputerTaskPlan;
  phase: ComputerTaskPhase;
  busy: boolean;
  labels: Translations["computer"];
  onConfirm: () => void;
  onCancel: () => void;
};

export function ComputerTaskPanel({
  plan,
  phase,
  busy,
  labels,
  onConfirm,
  onCancel,
}: ComputerTaskPanelProps) {
  const isFinal = phase === "final";
  const title = isFinal ? plan.finalTitle ?? labels.finalTitle : plan.title;
  const summary = isFinal ? plan.finalSummary ?? labels.finalSummary : plan.summary;

  return (
    <section className="computer-task-panel" aria-label={labels.title}>
      <header>
        <div className="computer-task-title">
          <ShieldCheck size={16} />
          <strong>{title}</strong>
        </div>
        <button type="button" title={labels.cancel} disabled={busy} onClick={onCancel}>
          <X size={15} />
        </button>
      </header>

      <p>{summary}</p>

      {!isFinal ? (
        <ol>
          {plan.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}

      <footer>
        <button type="button" disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </button>
        <button className="primary" type="button" disabled={busy} onClick={onConfirm}>
          {isFinal ? <Send size={15} /> : <Check size={15} />}
          {busy ? labels.running : isFinal ? labels.send : labels.run}
        </button>
      </footer>
    </section>
  );
}
