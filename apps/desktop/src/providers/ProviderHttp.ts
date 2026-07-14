import { isTauriRuntime } from "../tauri/tauriClient";

export type ProviderHttpResponse = {
  ok: boolean;
  status: number;
  text: string;
};

export async function postProviderJson(
  endpoint: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ProviderHttpResponse> {
  throwIfAborted(signal);

  try {
    if (isTauriRuntime()) {
      const { fetch: tauriFetch, Body, ResponseType } = await import("@tauri-apps/api/http");
      const request = tauriFetch<string>(endpoint, {
        method: "POST",
        headers,
        body: Body.json(payload),
        responseType: ResponseType.Text,
        timeout: 120,
      });
      const response = await withAbort(request, signal);
      return {
        ok: response.ok,
        status: response.status,
        text: response.data,
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      signal,
      headers,
      body: JSON.stringify(payload),
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  } catch (error) {
    if (signal?.aborted) throw abortError();
    const details = errorMessage(error);
    throw new Error(
      `Cannot connect to API endpoint ${endpoint}. Check the Base URL, network, and HTTPS certificate. Details: ${details}`,
    );
  }
}

export function parseProviderJson<T>(response: ProviderHttpResponse): T {
  try {
    return JSON.parse(response.text) as T;
  } catch {
    const preview = response.text.trim().slice(0, 240) || "<empty response>";
    throw new Error(`API returned invalid JSON (HTTP ${response.status}): ${preview}`);
  }
}

export function resolveOpenAIEndpoint(baseUrl: string): string {
  return appendEndpoint(baseUrl, "chat/completions");
}

export function resolveClaudeEndpoint(baseUrl: string): string {
  const base = normalizedBaseUrl(baseUrl);
  if (/\/messages$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/messages`;
  return `${base}/v1/messages`;
}

function appendEndpoint(baseUrl: string, suffix: string): string {
  const base = normalizedBaseUrl(baseUrl);
  return base.toLowerCase().endsWith(`/${suffix.toLowerCase()}`) ? base : `${base}/${suffix}`;
}

function normalizedBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(value)) {
    throw new Error("Base URL must start with http:// or https://.");
  }
  return value;
}

function withAbort<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => reject(abortError());
    signal.addEventListener("abort", handleAbort, { once: true });
    request.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function abortError(): Error {
  return new DOMException("The request was cancelled.", "AbortError");
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
