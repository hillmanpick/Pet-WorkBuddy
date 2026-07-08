import type { LoadedPetPack } from "./PetPackLoader";
import { normalizeAction, resolvePetEvent, type PetEvent } from "./PetStateMachine";

export type RuntimeResult = {
  action: string;
  bubble?: string;
};

export function nextPetAction(pack: LoadedPetPack | null, event: PetEvent): RuntimeResult {
  const resolved = resolvePetEvent(pack, event);
  return {
    action: normalizeAction(pack, resolved.action),
    bubble: resolved.bubble,
  };
}

export function randomIdleAction(pack: LoadedPetPack | null): string {
  if (!pack) return "idle";
  const candidates = ["idle", "positive"].filter((action) => pack.animations[action]);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? pack.defaultAnimation;
}
