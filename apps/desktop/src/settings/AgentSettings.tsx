import { RefreshCw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auditLogEventName, clearAuditLog, loadAuditLog } from "../agent/tools/AuditLog";
import { builtinPluginManifests } from "../agent/tools/ToolRegistry";
import type { AuditLogEntry } from "../agent/tools/ToolTypes";
import type { McpServerConfig, WorkBuddyConfig } from "../config/schema";
import type { Translations } from "../i18n";

type AgentSettingsProps = {
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
    second: "2-digit",
  }).format(new Date(timestamp));
}

function stringifyPreview(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function hasMojibake(value: string): boolean {
  return /�{2,}|锟斤拷|Ã.|Â./.test(value);
}

function cleanAuditText(value: string, fallback: string): string {
  return hasMojibake(value) ? fallback : value;
}

function normalizeMcpServers(value: unknown): Record<string, McpServerConfig> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected an object.");
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([id, server]) => {
      if (!server || typeof server !== "object" || Array.isArray(server)) {
        throw new Error(`Invalid MCP server: ${id}`);
      }
      const entry = server as Partial<McpServerConfig>;
      if (typeof entry.command !== "string" || !entry.command.trim()) {
        throw new Error(`MCP server '${id}' needs a command.`);
      }

      return [
        id,
        {
          command: entry.command,
          args: Array.isArray(entry.args) ? entry.args.filter((item): item is string => typeof item === "string") : [],
          env:
            entry.env && typeof entry.env === "object" && !Array.isArray(entry.env)
              ? Object.fromEntries(
                  Object.entries(entry.env).filter(
                    (item): item is [string, string] => typeof item[1] === "string",
                  ),
                )
              : {},
        },
      ];
    }),
  );
}

export function AgentSettings({ config, labels, onConfigChange }: AgentSettingsProps) {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => loadAuditLog());
  const [mcpDraft, setMcpDraft] = useState(() => JSON.stringify(config.agent.mcpServers, null, 2));
  const [mcpError, setMcpError] = useState<string | null>(null);
  const sortedAuditLog = useMemo(() => [...auditLog].sort((a, b) => b.startedAt - a.startedAt), [auditLog]);

  useEffect(() => {
    setMcpDraft(JSON.stringify(config.agent.mcpServers, null, 2));
    setMcpError(null);
  }, [config.agent.mcpServers]);

  useEffect(() => {
    const refresh = () => setAuditLog(loadAuditLog());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener(auditLogEventName(), refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(auditLogEventName(), refresh);
    };
  }, []);

  function updateAgent(value: Partial<WorkBuddyConfig["agent"]>) {
    onConfigChange({
      ...config,
      agent: {
        ...config.agent,
        ...value,
      },
    });
  }

  function applyMcpDraft() {
    try {
      const parsed = normalizeMcpServers(JSON.parse(mcpDraft));
      setMcpError(null);
      updateAgent({ mcpServers: parsed });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMcpError(`${labels.invalidJson}: ${message}`);
    }
  }

  function clearLog() {
    clearAuditLog();
    setAuditLog([]);
  }

  return (
    <div className="settings-stack agent-settings">
      <section className="settings-group">
        <h3>{labels.runtime}</h3>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={config.agent.enabled}
            onChange={(event) => updateAgent({ enabled: event.target.checked })}
          />
          <span>{labels.enabled}</span>
        </label>

        <label className="field agent-number-field">
          <span>{labels.maxIterations}</span>
          <input
            type="number"
            min={1}
            max={8}
            value={config.agent.maxIterations}
            onChange={(event) =>
              updateAgent({ maxIterations: Math.max(1, Math.min(8, Number(event.target.value) || 3)) })
            }
          />
        </label>
        <p className="settings-help">{labels.runtimeHelp}</p>
      </section>

      <section className="settings-group">
        <header>
          <h3>{labels.mcpServers}</h3>
          <button type="button" title={labels.applyMcp} onClick={applyMcpDraft}>
            <Save size={15} />
          </button>
        </header>
        <textarea
          className="mcp-editor"
          value={mcpDraft}
          spellCheck={false}
          onChange={(event) => setMcpDraft(event.target.value)}
        />
        <p className={mcpError ? "settings-note" : "settings-help"}>{mcpError ?? labels.mcpHelp}</p>
      </section>

      <section className="settings-group">
        <h3>{labels.builtInTools}</h3>
        <div className="agent-plugin-grid">
          {builtinPluginManifests.map((plugin) => (
            <article className="agent-plugin-card" key={plugin.id}>
              <header>
                <strong>{plugin.name}</strong>
                <span>{plugin.permissions.join(", ")}</span>
              </header>
              <div className="agent-tool-list">
                {plugin.tools.map((tool) => (
                  <span className={`risk-pill risk-${tool.risk}`} key={tool.name} title={tool.description}>
                    {tool.name} · {tool.risk}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <header>
          <h3>{labels.auditLog}</h3>
          <span className="settings-icon-row">
            <button type="button" title={labels.refresh} onClick={() => setAuditLog(loadAuditLog())}>
              <RefreshCw size={15} />
            </button>
            <button type="button" title={labels.clear} onClick={clearLog}>
              <Trash2 size={15} />
            </button>
          </span>
        </header>
        {sortedAuditLog.length ? (
          <div className="audit-log-list">
            {sortedAuditLog.map((entry) => (
              <AuditLogRow entry={entry} labels={labels} key={entry.id} />
            ))}
          </div>
        ) : (
          <p className="settings-help">{labels.auditEmpty}</p>
        )}
      </section>
    </div>
  );
}

function AuditLogRow({ entry, labels }: { entry: AuditLogEntry; labels: Translations["agent"] }) {
  const message = cleanAuditText(entry.message, labels.legacyEncodingHidden);
  const argumentsPreview = cleanAuditText(stringifyPreview(entry.argumentsPreview), labels.legacyEncodingHidden);

  return (
    <article className={`audit-log-entry ${entry.ok ? "ok" : "failed"}`}>
      <header>
        <strong>{entry.tool}</strong>
        <time dateTime={new Date(entry.startedAt).toISOString()}>{formatDateTime(entry.startedAt)}</time>
      </header>
      <div className="audit-log-meta">
        <span className={`risk-pill risk-${entry.risk}`}>{entry.risk}</span>
        <span>{entry.approved ? labels.approved : labels.blocked}</span>
        <span>{entry.endedAt - entry.startedAt}ms</span>
      </div>
      <p>{message}</p>
      <details>
        <summary>{labels.arguments}</summary>
        <pre>{argumentsPreview}</pre>
      </details>
    </article>
  );
}
