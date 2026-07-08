import { useEffect, useRef } from "react";
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

type PetRendererProps = {
  pack: LoadedPetPack | null;
  action: string;
  actionToken: number;
  rotationYaw: number;
  autoRotate?: boolean;
};

export function PetRenderer({ pack, action, actionToken, rotationYaw, autoRotate = false }: PetRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PetActionPlayer | null>(null);
  const modelRef = useRef<Group | null>(null);
  const rotationRef = useRef(rotationYaw);
  const actionRef = useRef(action);
  const autoRotateRef = useRef(autoRotate);

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

    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      mixer?.update(delta);

      const model = modelRef.current;
      if (model) {
        if (autoRotateRef.current) {
          rotationRef.current += delta * 0.35;
        }
        const isWalking = actionRef.current === "walk" || actionRef.current === "run";
        model.rotation.y = rotationRef.current;
        model.position.y = -0.15 + (isWalking ? Math.sin(performance.now() / 135) * 0.025 : 0);
      }

      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
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
