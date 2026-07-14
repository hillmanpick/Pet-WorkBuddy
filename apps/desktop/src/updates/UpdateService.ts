import type { UiLanguage } from "../config/schema";
import { isTauriRuntime, writeAppLog } from "../tauri/tauriClient";

const UPDATE_ENDPOINT = "https://www.hillmanpick.xin/workbuddy/api/v1/update/windows";

type UpdateManifest = {
  product: string;
  platform: string;
  version: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  publishedAt: string;
  notes?: Partial<Record<UiLanguage, string[]>>;
};

let startupUpdateCheck: Promise<void> | null = null;

export function checkForUpdatesOnStartup(language: UiLanguage): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve();
  if (!startupUpdateCheck) {
    startupUpdateCheck = checkForUpdates(language).catch((error) => {
      writeAppLog("updateCheck:failed", { error: errorMessage(error) });
    });
  }
  return startupUpdateCheck;
}

async function checkForUpdates(language: UiLanguage): Promise<void> {
  const { getVersion } = await import("@tauri-apps/api/app");
  const currentVersion = await getVersion();
  const manifest = await fetchUpdateManifest(currentVersion);

  writeAppLog("updateCheck:completed", {
    currentVersion,
    latestVersion: manifest.version,
  });
  if (!isVersionNewer(manifest.version, currentVersion)) return;

  const { ask } = await import("@tauri-apps/api/dialog");
  const accepted = await ask(updateMessage(manifest, currentVersion, language), {
    title: language === "zh" ? "WorkBuddy 更新" : "WorkBuddy Update",
    type: "info",
    okLabel: language === "zh" ? "下载更新" : "Download",
    cancelLabel: language === "zh" ? "稍后" : "Later",
  });
  if (!accepted) return;

  const downloadUrl = new URL(manifest.downloadUrl);
  if (downloadUrl.protocol !== "https:") {
    throw new Error("The update download URL must use HTTPS.");
  }
  const { open } = await import("@tauri-apps/api/shell");
  await open(downloadUrl.href);
  writeAppLog("updateCheck:downloadOpened", { version: manifest.version });
}

async function fetchUpdateManifest(currentVersion: string): Promise<UpdateManifest> {
  const endpoint = new URL(UPDATE_ENDPOINT);
  endpoint.searchParams.set("current", currentVersion);
  const { fetch: tauriFetch, ResponseType } = await import("@tauri-apps/api/http");
  const response = await tauriFetch<unknown>(endpoint.href, {
    method: "GET",
    responseType: ResponseType.JSON,
    timeout: 15,
  });

  if (!response.ok) {
    throw new Error(`Update server returned HTTP ${response.status}.`);
  }
  if (!isUpdateManifest(response.data)) {
    throw new Error("Update server returned an invalid manifest.");
  }
  return response.data;
}

export function isVersionNewer(latest: string, current: string): boolean {
  const latestVersion = parseVersion(latest);
  const currentVersion = parseVersion(current);
  const length = Math.max(latestVersion.parts.length, currentVersion.parts.length);

  for (let index = 0; index < length; index += 1) {
    const latestPart = latestVersion.parts[index] ?? 0;
    const currentPart = currentVersion.parts[index] ?? 0;
    if (latestPart !== currentPart) return latestPart > currentPart;
  }

  if (!latestVersion.prerelease && currentVersion.prerelease) return true;
  if (latestVersion.prerelease && !currentVersion.prerelease) return false;
  return latestVersion.prerelease > currentVersion.prerelease;
}

function parseVersion(value: string): { parts: number[]; prerelease: string } {
  const normalized = value.trim().replace(/^v/i, "");
  const [core, prerelease = ""] = normalized.split("-", 2);
  return {
    parts: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
    prerelease,
  };
}

function updateMessage(manifest: UpdateManifest, currentVersion: string, language: UiLanguage): string {
  const notes = manifest.notes?.[language] ?? manifest.notes?.en ?? [];
  const noteText = notes.length ? `\n\n${notes.slice(0, 5).map((note) => `- ${note}`).join("\n")}` : "";
  if (language === "zh") {
    return `发现 WorkBuddy ${manifest.version}。\n当前版本：${currentVersion}${noteText}\n\n是否打开下载页面？`;
  }
  return `WorkBuddy ${manifest.version} is available.\nCurrent version: ${currentVersion}${noteText}\n\nOpen the download now?`;
}

function isUpdateManifest(value: unknown): value is UpdateManifest {
  if (!value || typeof value !== "object") return false;
  const manifest = value as Partial<UpdateManifest>;
  return (
    typeof manifest.product === "string" &&
    typeof manifest.platform === "string" &&
    typeof manifest.version === "string" &&
    typeof manifest.downloadUrl === "string" &&
    typeof manifest.sha256 === "string" &&
    typeof manifest.size === "number" &&
    typeof manifest.publishedAt === "string"
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
