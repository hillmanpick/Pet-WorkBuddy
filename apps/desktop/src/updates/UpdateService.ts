import type { UiLanguage } from "../config/schema";
import { isTauriRuntime, writeAppLog } from "../tauri/tauriClient";

const LATEST_RELEASE_ENDPOINT = "https://api.github.com/repos/hillmanpick/Pet-WorkBuddy/releases/latest";

type UpdateManifest = {
  version: string;
  downloadUrl: string;
  size: number;
  publishedAt: string;
  notes?: Partial<Record<UiLanguage, string[]>>;
};

type GitHubRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  body: string | null;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    state: string;
  }>;
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
  const manifest = await fetchUpdateManifest(language);

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
  if (downloadUrl.protocol !== "https:" || downloadUrl.hostname !== "github.com") {
    throw new Error("The update download URL must use HTTPS.");
  }
  const { open } = await import("@tauri-apps/api/shell");
  await open(downloadUrl.href);
  writeAppLog("updateCheck:downloadOpened", { version: manifest.version });
}

async function fetchUpdateManifest(language: UiLanguage): Promise<UpdateManifest> {
  const { fetch: tauriFetch, ResponseType } = await import("@tauri-apps/api/http");
  const response = await tauriFetch<unknown>(LATEST_RELEASE_ENDPOINT, {
    method: "GET",
    responseType: ResponseType.JSON,
    timeout: 15,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status} while checking for updates.`);
  }
  if (!isGitHubRelease(response.data) || response.data.draft || response.data.prerelease) {
    throw new Error("GitHub returned an invalid or non-stable release.");
  }

  const version = response.data.tag_name.replace(/^v/i, "");
  const asset = response.data.assets.find(
    (candidate) => candidate.name === `WorkBuddy_${version}_x64-setup.exe` && candidate.state === "uploaded",
  );
  if (!asset) {
    throw new Error(`GitHub release ${response.data.tag_name} has no Windows x64 installer.`);
  }

  const notes = releaseNotes(response.data.body ?? "", language);
  return {
    version,
    downloadUrl: asset.browser_download_url,
    size: asset.size,
    publishedAt: response.data.published_at ?? "",
    notes: { [language]: notes },
  };
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
    return `发现 WorkBuddy ${manifest.version}。\n当前版本：${currentVersion}${noteText}\n\n是否从 GitHub 下载新版安装包？`;
  }
  return `WorkBuddy ${manifest.version} is available.\nCurrent version: ${currentVersion}${noteText}\n\nDownload the installer from GitHub now?`;
}

function isGitHubRelease(value: unknown): value is GitHubRelease {
  if (!value || typeof value !== "object") return false;
  const release = value as Partial<GitHubRelease>;
  return (
    typeof release.tag_name === "string" &&
    typeof release.draft === "boolean" &&
    typeof release.prerelease === "boolean" &&
    (typeof release.published_at === "string" || release.published_at === null) &&
    (typeof release.body === "string" || release.body === null) &&
    Array.isArray(release.assets) &&
    release.assets.every(
      (asset) =>
        asset &&
        typeof asset.name === "string" &&
        typeof asset.browser_download_url === "string" &&
        typeof asset.size === "number" &&
        typeof asset.state === "string",
    )
  );
}

function releaseNotes(body: string, language: UiLanguage): string[] {
  const heading = language === "zh" ? /^##\s+更新内容\s*$/im : /^##\s+What's new\s*$/im;
  const match = heading.exec(body);
  const section = match ? body.slice(match.index + match[0].length) : body;
  const lines = section.split(/\r?\n/).map((line) => line.trim());
  const nextHeading = lines.findIndex((line) => line.startsWith("## "));
  const releaseLines = nextHeading < 0 ? lines : lines.slice(0, nextHeading);
  return releaseLines
    .filter((line) => line.startsWith("- ") && !/^[-*]\s*sha-?256\s*:/i.test(line))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
    .slice(0, 5);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
