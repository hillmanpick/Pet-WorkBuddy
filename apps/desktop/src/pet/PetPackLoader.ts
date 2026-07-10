import type { PetManifest, PetPack } from "../config/schema";
import { invokeCommand, isTauriRuntime } from "../tauri/tauriClient";

export type LoadedPetPack = PetPack & {
  manifestPath: string;
  basePath: string;
  custom?: boolean;
  localBasePath?: string;
};

const ASSET_BASE = import.meta.env.BASE_URL || "./";
const MANIFEST_URL = `${ASSET_BASE}pet-packs/manifest.json`;

type PetManifestEntry = PetManifest["pets"][number] & {
  custom?: boolean;
};

type CustomPetPackEntry = {
  id: string;
  path: string;
};

type TauriAssetWindow = Window & {
  __TAURI__?: {
    convertFileSrc?: (filePath: string, protocol?: string) => string;
  };
};

export async function loadPetManifest(): Promise<PetManifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to load pet manifest: ${response.status}`);
  }
  return response.json();
}

export async function loadPetManifestEntries(): Promise<PetManifestEntry[]> {
  const manifest = await loadPetManifest();
  const customEntries = await loadCustomPetManifestEntries();
  return [
    ...manifest.pets.map((entry) => ({ ...entry, custom: false })),
    ...customEntries.map((entry) => ({ id: entry.id, path: entry.path, custom: true })),
  ];
}

export async function loadPetCatalog(): Promise<LoadedPetPack[]> {
  const entries = await loadPetManifestEntries();
  const loaded = await Promise.allSettled(entries.map((entry) => loadPetPack(entry.path, entry.custom)));
  return loaded.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}

export async function loadPetPack(path: string, custom = isNativeFilePath(path)): Promise<LoadedPetPack> {
  const url = custom ? convertLocalFileSrc(path) : new URL(path, window.location.href).toString();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load pet pack: ${path}`);
  }

  const pack = (await response.json()) as PetPack;
  const localBasePath = custom ? nativeDirname(path) : undefined;
  return {
    ...pack,
    manifestPath: url,
    basePath: custom ? "" : url.slice(0, url.lastIndexOf("/") + 1),
    custom,
    localBasePath,
  };
}

export async function loadPetPackById(id: string): Promise<LoadedPetPack> {
  const entries = await loadPetManifestEntries();
  const manifest = await loadPetManifest();
  const entry =
    entries.find((pet) => pet.id === id) ??
    entries.find((pet) => pet.id === manifest.defaultPetId) ??
    entries[0];
  if (!entry) {
    throw new Error("No pet packs are available.");
  }
  return loadPetPack(entry.path, entry.custom);
}

export function resolvePetAsset(pack: LoadedPetPack, file: string): string {
  if (/^(https?|asset):\/\//.test(file) || file.startsWith("/")) return file;
  if (pack.localBasePath) {
    return convertLocalFileSrc(joinNativePath(pack.localBasePath, file));
  }
  return `${pack.basePath}${file}`;
}

async function loadCustomPetManifestEntries(): Promise<CustomPetPackEntry[]> {
  if (!isTauriRuntime()) return [];
  try {
    return await invokeCommand<CustomPetPackEntry[]>("list_custom_pet_packs");
  } catch {
    return [];
  }
}

function isNativeFilePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\") || path.startsWith("/");
}

function nativeDirname(path: string): string {
  const slashIndex = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return slashIndex >= 0 ? path.slice(0, slashIndex) : path;
}

function joinNativePath(basePath: string, file: string): string {
  const separator = basePath.includes("\\") ? "\\" : "/";
  const cleanBase = basePath.replace(/[\\/]+$/, "");
  const cleanFile = file.replace(/^[\\/]+/, "").replace(/[\\/]+/g, separator);
  return `${cleanBase}${separator}${cleanFile}`;
}

function convertLocalFileSrc(path: string): string {
  return (window as TauriAssetWindow).__TAURI__?.convertFileSrc?.(path, "asset") ?? path;
}
