import type { ProviderId } from "../config/schema";
import { getProviderJson, parseProviderJson } from "./ProviderHttp";

type ModelListResponse = {
  data?: Array<{ id?: string; name?: string; model?: string }>;
  models?: Array<{ id?: string; name?: string; model?: string } | string>;
};

export async function fetchProviderModels(
  providerId: ProviderId,
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  if (!apiKey.trim()) throw new Error("Add an API key before loading models.");

  const endpoint = resolveModelListEndpoint(providerId, baseUrl);
  const headers: Record<string, string> = providerId === "claude"
    ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
    : { Authorization: `Bearer ${apiKey}` };
  const response = await getProviderJson(endpoint, headers);
  if (!response.ok) throw new Error(`Model list request failed (HTTP ${response.status}).`);

  const payload = parseProviderJson<ModelListResponse | Array<string | { id?: string; name?: string; model?: string }>>(response);
  const entries = Array.isArray(payload) ? payload : payload.data ?? payload.models ?? [];
  return [...new Set(entries.map((entry) => {
    if (typeof entry === "string") return entry;
    return entry.id ?? entry.model ?? entry.name ?? "";
  }).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function resolveModelListEndpoint(providerId: ProviderId, baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "").replace(/\/(chat\/completions|messages|models)$/i, "");
  if (!/^https?:\/\//i.test(base)) throw new Error("Base URL must start with http:// or https://.");

  if (providerId === "claude") {
    return /\/v1$/i.test(base) ? `${base}/models` : `${base}/v1/models`;
  }
  return `${base}/models`;
}
