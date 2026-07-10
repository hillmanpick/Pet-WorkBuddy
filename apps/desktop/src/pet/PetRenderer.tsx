import { useEffect, useMemo, useRef, useState } from "react";
import {
  AmbientLight,
  AnimationMixer,
  Box3,
  Clock,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Group,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LoadedPetPack } from "./PetPackLoader";
import { resolvePetAsset } from "./PetPackLoader";
import { PetActionPlayer } from "./PetActionPlayer";
import { getGlobalCursorPosition, getWindowFrame, isTauriRuntime } from "../tauri/tauriClient";

type PetRendererProps = {
  pack: LoadedPetPack | null;
  action: string;
  actionToken: number;
  rotationYaw: number;
  autoRotate?: boolean;
  followPointer?: boolean;
};

export function PetRenderer({
  pack,
  action,
  actionToken,
  rotationYaw,
  autoRotate = false,
  followPointer = true,
}: PetRendererProps) {
  if (pack?.type === "sprite") {
    return (
      <SpritePetRenderer
        pack={pack}
        action={action}
        actionToken={actionToken}
        rotationYaw={rotationYaw}
      />
    );
  }

  return (
    <GltfPetRenderer
      pack={pack}
      action={action}
      actionToken={actionToken}
      rotationYaw={rotationYaw}
      autoRotate={autoRotate}
      followPointer={followPointer}
    />
  );
}

function GltfPetRenderer({
  pack,
  action,
  actionToken,
  rotationYaw,
  autoRotate = false,
  followPointer = true,
}: PetRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PetActionPlayer | null>(null);
  const modelRef = useRef<Group | null>(null);
  const rotationRef = useRef(rotationYaw);
  const actionRef = useRef(action);
  const autoRotateRef = useRef(autoRotate);
  const followPointerRef = useRef(followPointer);
  const pointerTargetRef = useRef({ x: 0, y: 0 });
  const pointerCurrentRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    rotationRef.current = rotationYaw;
  }, [rotationYaw]);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    followPointerRef.current = followPointer;
  }, [followPointer]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pack) return undefined;
    const containerElement = container;

    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 1.2, 6);

    const renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerElement.replaceChildren(renderer.domElement);

    const ambient = new AmbientLight(0xffffff, 0.9);
    const keyLight = new DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(3, 4, 5);
    scene.add(ambient, keyLight);

    const clock = new Clock();
    let disposed = false;
    let mixer: { update(delta: number): void } | null = null;

    function resize() {
      const width = Math.max(containerElement.clientWidth, 1);
      const height = Math.max(containerElement.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    const loader = new GLTFLoader();
    loader.load(resolvePetAsset(pack, pack.model), (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.scale.setScalar(pack.scale ?? 1);

      const box = new Box3().setFromObject(model);
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      model.position.sub(center);
      const maxAxis = Math.max(size.x, size.y, size.z) || 1;
      model.scale.multiplyScalar(2.6 / maxAxis);
      model.position.y -= 0.15;

      scene.add(model);
      modelRef.current = model;

      const realMixer = new AnimationMixer(model);
      mixer = realMixer;
      playerRef.current = new PetActionPlayer({
        mixer: realMixer,
        clips: gltf.animations,
        pack,
      });
      playerRef.current.play(action);
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(containerElement);
    resize();

    function clampPointer(value: number) {
      return Math.max(-1, Math.min(1, value));
    }

    function easePointer(value: number) {
      const sign = Math.sign(value);
      const abs = Math.abs(value);
      if (abs < 0.04) return 0;
      return sign * Math.pow((abs - 0.04) / 0.96, 0.82);
    }

    function setPointerTarget(x: number, y: number) {
      pointerTargetRef.current = {
        x: easePointer(clampPointer(x)),
        y: easePointer(clampPointer(y)),
      };
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = containerElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setPointerTarget(
        (event.clientX - centerX) / Math.max(rect.width * 0.72, 1),
        (event.clientY - centerY) / Math.max(rect.height * 0.72, 1),
      );
    }

    window.addEventListener("pointermove", handlePointerMove);

    let globalPointerTimer = 0;
    let globalPointerInFlight = false;
    if (isTauriRuntime()) {
      globalPointerTimer = window.setInterval(() => {
        if (globalPointerInFlight || disposed || !followPointerRef.current) return;
        globalPointerInFlight = true;
        void Promise.all([getGlobalCursorPosition(), getWindowFrame()])
          .then(([cursor, frame]) => {
            if (!cursor || !frame || disposed) return;
            const rect = containerElement.getBoundingClientRect();
            const scale = frame.scaleFactor || window.devicePixelRatio || 1;
            const centerX = frame.x + (rect.left + rect.width / 2) * scale;
            const centerY = frame.y + (rect.top + rect.height / 2) * scale;
            setPointerTarget(
              (cursor.x - centerX) / Math.max(rect.width * scale * 0.72, 1),
              (cursor.y - centerY) / Math.max(rect.height * scale * 0.72, 1),
            );
          })
          .finally(() => {
            globalPointerInFlight = false;
          });
      }, 40);
    }

    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      mixer?.update(delta);

      const model = modelRef.current;
      if (model) {
        if (autoRotateRef.current) {
          rotationRef.current += delta * 0.35;
        }
        const isWalking = actionRef.current === "walk" || actionRef.current === "run";
        const target = followPointerRef.current ? pointerTargetRef.current : { x: 0, y: 0 };
        const current = pointerCurrentRef.current;
        const followEase = Math.min(1, delta * 9);
        current.x += (target.x - current.x) * followEase;
        current.y += (target.y - current.y) * followEase;
        const pointerYaw = current.x * 0.28;
        const pointerPitch = current.y * 0.08;
        model.rotation.y = rotationRef.current + pointerYaw;
        model.rotation.x = pointerPitch;
        model.position.y = -0.15 + (isWalking ? Math.sin(performance.now() / 135) * 0.025 : 0);
      }

      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.clearInterval(globalPointerTimer);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();
      renderer.dispose();
      scene.clear();
      modelRef.current = null;
      playerRef.current = null;
    };
  }, [pack]);

  useEffect(() => {
    playerRef.current?.play(action);
  }, [action, actionToken]);

  return <div className="pet-renderer" ref={containerRef} />;
}

function SpritePetRenderer({
  pack,
  action,
  actionToken,
  rotationYaw,
}: Pick<PetRendererProps, "pack" | "action" | "actionToken" | "rotationYaw"> & {
  pack: LoadedPetPack;
}) {
  const [frameIndex, setFrameIndex] = useState(0);
  const animation = pack.animations[action] ?? pack.animations[pack.defaultAnimation];
  const frameFiles = useMemo(() => {
    const files = animation?.frames?.length
      ? animation.frames
      : [animation?.file ?? pack.model].filter(Boolean);
    return files.map((file) => resolvePetAsset(pack, file));
  }, [animation, pack]);
  const fps = Math.max(1, Math.min(animation?.fps ?? 12, 30));
  const shouldLoop = animation?.loop ?? true;

  useEffect(() => {
    setFrameIndex(0);
  }, [action, actionToken, frameFiles.join("|")]);

  useEffect(() => {
    if (frameFiles.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current + 1 < frameFiles.length) return current + 1;
        return shouldLoop ? 0 : current;
      });
    }, 1000 / fps);

    return () => window.clearInterval(timer);
  }, [fps, frameFiles.length, shouldLoop]);

  const src = frameFiles[Math.min(frameIndex, frameFiles.length - 1)];
  const facing = rotationYaw < 0 ? -1 : 1;

  return (
    <div className="pet-renderer pet-sprite-renderer">
      {src ? (
        <img
          key={`${action}-${actionToken}`}
          src={src}
          alt=""
          draggable={false}
          style={{ transform: `scaleX(${facing})` }}
        />
      ) : null}
    </div>
  );
}
