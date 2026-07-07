import type { PetManifest, PetPack } from "../config/schema";

export type LoadedPetPack = PetPack & {
  manifestPath: string;
  basePath: string;
};

const ASSET_BASE = import.meta.env.BASE_URL || "./";
const MANIFEST_URL = `${ASSET_BASE}pet-packs/manifest.json`;

export async function loadPetManifest(): Promise<PetManifest> {
  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(`Failed to load pet manifest: ${response.status}`);
  }
  return response.json();
}

export async function loadPetPack(path: string): Promise<LoadedPetPack> {
  const url = new URL(path, window.location.href).toString();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load pet pack: ${path}`);
  }

  const pack = (await response.json()) as PetPack;
  return {
    ...pack,
    manifestPath: url,
    basePath: url.slice(0, url.lastIndexOf("/") + 1),
  };
}

export async function loadPetPackById(id: string): Promise<LoadedPetPack> {
  const manifest = await loadPetManifest();
  const entry = manifest.pets.find((pet) => pet.id === id) ?? manifest.pets[0];
  if (!entry) {
    throw new Error("No pet packs are available.");
  }
  return loadPetPack(entry.path);
}

export function resolvePetAsset(pack: LoadedPetPack, file: string): string {
  if (/^https?:\/\//.test(file) || file.startsWith("/")) return file;
  return `${pack.basePath}${file}`;
}
