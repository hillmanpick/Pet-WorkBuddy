import type { AnimationAction, AnimationClip, AnimationMixer } from "three";
import { LoopOnce, LoopRepeat } from "three";
import type { LoadedPetPack } from "./PetPackLoader";

export type PetActionPlayerInput = {
  mixer: AnimationMixer;
  clips: AnimationClip[];
  pack: LoadedPetPack;
};

export class PetActionPlayer {
  private currentAction: AnimationAction | null = null;

  constructor(private readonly input: PetActionPlayerInput) {}

  play(actionName: string): void {
    const animation =
      this.input.pack.animations[actionName] ??
      this.input.pack.animations[this.input.pack.defaultAnimation];

    const clipName = animation?.clip ?? animation?.file ?? this.input.pack.defaultAnimation;
    const clip = this.input.clips.find((item) => item.name === clipName) ?? this.input.clips[0];
    if (!clip) return;

    const nextAction = this.input.mixer.clipAction(clip);
    const shouldLoop = animation?.loop ?? true;
    nextAction.reset();
    nextAction.setLoop(shouldLoop ? LoopRepeat : LoopOnce, shouldLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !shouldLoop;
    nextAction.enabled = true;

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.fadeOut(0.15);
      nextAction.fadeIn(0.15);
    }

    nextAction.play();
    this.currentAction = nextAction;
  }
}

