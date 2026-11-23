import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { mapAnatomy } from "@/domain/anatomyMap";
import type { MuscleFinding } from "@/domain/muscleFindings";
import type { PainMark, RegionId, TestCue } from "@/domain/types";

export type BodyHit = {
  meshName: string;
  label: string;
  regionId: RegionId;
  side: PainMark["side"];
  point: [number, number, number];
};

const MODEL = "/models/body.glb";

let preloadTask: Promise<void> | null = null;
let preloadValue = 0;
const preloadListeners = new Set<(value: number, ready: boolean) => void>();

function notify(value: number, ready: boolean) {
  preloadValue = value;
  for (const listener of preloadListeners) listener(value, ready);
}

export function preloadBodyModel() {
  if (!preloadTask) {
    preloadTask = (async () => {
      const response = await fetch(MODEL);
      const length = Number(response.headers.get("content-length") || 0);
      if (!response.body || !length) {
        await response.arrayBuffer();
        notify(92, false);
      } else {
        const reader = response.body.getReader();
        let received = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          received += chunk.value.byteLength;
          notify(Math.min(90, Math.round((received / length) * 90)), false);
        }
      }
      await useGLTF.preload(MODEL, "/draco/");
      notify(100, true);
    })().catch(() => {
      preloadTask = null;
      notify(0, false);
    });
  }
  return preloadTask;
}

preloadBodyModel();

function ancestry(object: THREE.Object3D): Record<string, unknown> {
  let current: THREE.Object3D | null = object;
  while (current) {
    const data = current.userData;
    if (data?.name || data?.type) return data;
    current = current.parent;
  }
  return object.userData ?? {};
}

function meshOf(object: THREE.Object3D): THREE.Mesh | null {
  const mesh = object as THREE.Mesh;
  return mesh.isMesh ? mesh : null;
}

function describe(mesh: THREE.Mesh, point: THREE.Vector3): BodyHit {
  const data = ancestry(mesh);
  const english = String(data.name || mesh.name || "未命名");
  const detail = String(data.nameDetail || "");
  const mapped = mapAnatomy(english, `${detail} ${mesh.name}`);
  const side: PainMark["side"] = point.x > 0.025 ? "left" : point.x < -0.025 ? "right" : "bilateral";
  return {
    meshName: mesh.uuid,
    label: mapped.labelZh === english ? english : `${mapped.labelZh} · ${english}`,
    regionId: mapped.regionId,
    side,
    point: [Number(point.x.toFixed(4)), Number(point.y.toFixed(4)), Number(point.z.toFixed(4))],
  };
}

function paint(mesh: THREE.Mesh, kind: "select" | "finding" | null) {
  const current = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  if (!mesh.userData.baseMaterial) mesh.userData.baseMaterial = current;
  if (!kind) {
    mesh.material = mesh.userData.baseMaterial as THREE.Material;
    return;
  }
  const material = (mesh.userData.baseMaterial as THREE.Material).clone();
  if ("emissive" in material || "color" in material) {
    const standard = material as THREE.MeshStandardMaterial;
    if ("color" in standard && kind === "finding") standard.color = new THREE.Color("#e2b15a");
    if ("emissive" in standard) {
      standard.emissive = new THREE.Color(kind === "select" ? "#8f2d2d" : "#a36b12");
      standard.emissiveIntensity = kind === "select" ? 0.72 : 0.45;
    }
  }
  mesh.material = material;
}

function shiftToFloor(mesh: THREE.Mesh, slot: number) {
  const parent = mesh.parent;
  if (!parent) return;
  if (!mesh.userData.homePosition) mesh.userData.homePosition = mesh.position.clone();
  const origin = new THREE.Vector3();
  mesh.getWorldPosition(origin);
  const column = slot % 6;
  const row = Math.floor(slot / 6);
  const dest = new THREE.Vector3(-0.5 + column * 0.18, 0.04 + row * 0.07, 0.5);
  const delta = dest.sub(origin);
  const inverse = parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  mesh.position.add(delta.applyQuaternion(inverse));
  mesh.userData.parked = true;
}

function restoreMesh(mesh: THREE.Mesh) {
  const home = mesh.userData.homePosition as THREE.Vector3 | undefined;
  if (!home) return;
  mesh.position.copy(home);
  mesh.userData.parked = false;
}

export type AnatomyCue = TestCue & { id: string; side?: PainMark["side"] };

function meshCenterX(mesh: THREE.Mesh) {
  return new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).x;
}

function meshesForCue(scene: THREE.Object3D, cue: AnatomyCue) {
  const re = new RegExp(cue.pattern, "i");
  const meshes: THREE.Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const data = ancestry(mesh);
    const type = String(data.type ?? "");
    if (cue.layer === "bone" && type !== "bone") return;
    if (cue.layer === "muscle" && type === "bone") return;
    const name = `${data.name || ""} ${data.nameDetail || ""} ${mesh.name}`;
    if (!re.test(name)) return;
    meshes.push(mesh);
  });
  if (!cue.side || cue.side === "bilateral") return meshes;
  const sided = meshes.filter((mesh) => {
    const x = meshCenterX(mesh);
    if (Math.abs(x) < 0.02) return true;
    return cue.side === "left" ? x > 0 : x < 0;
  });
  return sided.length > 0 ? sided : meshes;
}

function aimSet(meshes: THREE.Mesh[], side: PainMark["side"] | undefined) {
  if (side === "left") return meshes.filter((mesh) => meshCenterX(mesh) > -0.02);
  if (side === "right") return meshes.filter((mesh) => meshCenterX(mesh) < 0.02);
  const right = meshes.filter((mesh) => meshCenterX(mesh) < -0.02);
  return right.length > 0 ? right : meshes;
}

function approachDir(center: THREE.Vector3, approach: TestCue["approach"]) {
  const lateral = center.x >= 0 ? 1 : -1;
  if (approach === "front") return new THREE.Vector3(0, 0.05, 1).normalize();
  if (approach === "back") return new THREE.Vector3(0, 0.05, -1).normalize();
  if (approach === "lateral") return new THREE.Vector3(lateral, 0.12, 0.25).normalize();
  return new THREE.Vector3(-lateral, 0.08, 0.4).normalize();
}

function Anatomy({
  marks,
  focusId,
  findings,
  cue,
  showMuscle,
  showBone,
  resetTick,
  onFocus,
  onSelect,
}: {
  marks: PainMark[];
  focusId: string | null;
  findings: MuscleFinding[];
  cue: AnatomyCue | null;
  showMuscle: boolean;
  showBone: boolean;
  resetTick: number;
  onFocus: (hit: BodyHit) => void;
  onSelect: (markId: string) => void;
}) {
  const gltf = useGLTF(MODEL, "/draco/");
  const pile = useRef(0);
  const justRestored = useRef(false);
  const arrow = useMemo(() => {
    const helper = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.001, 0x8f2d2d, 0.04, 0.025);
    helper.visible = false;
    helper.raycast = () => null;
    return helper;
  }, []);
  const camera = useThree((state) => state.camera);
  const get = useThree((state) => state.get);

  useEffect(() => {
    const tuned = new Set<THREE.Material>();
    gltf.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const type = String(ancestry(mesh).type ?? "");
      mesh.visible = type === "bone" ? showBone : type === "muscle" ? showMuscle : mesh.visible;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const base = (mesh.userData.baseMaterial as THREE.Material | undefined) ?? material;
        if (!base || tuned.has(base)) continue;
        tuned.add(base);
        if (base.name === "Mat_Muscle_Pro" && "color" in base) {
          (base as THREE.MeshStandardMaterial).color = new THREE.Color("#a34b3a");
        }
      }
    });
  }, [gltf.scene, showBone, showMuscle]);

  useEffect(() => {
    if (resetTick === 0) return;
    pile.current = 0;
    gltf.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) restoreMesh(mesh);
    });
  }, [gltf.scene, resetTick]);

  useEffect(() => {
    const matchers = findings.map((finding) => ({ ...finding, re: new RegExp(finding.pattern, "i") }));
    const cueRe = cue ? new RegExp(cue.pattern, "i") : null;
    gltf.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const data = ancestry(mesh);
      const type = String(data.type ?? "");
      const name = `${data.name || ""} ${data.nameDetail || ""} ${mesh.name}`;
      const found = matchers.some((finding) => finding.re.test(name));
      let cueHit = false;
      if (cue && cueRe?.test(name)) {
        const layerOk = cue.layer === "bone" ? type === "bone" : type !== "bone";
        const x = meshCenterX(mesh);
        const sideOk = !cue.side || cue.side === "bilateral" || Math.abs(x) < 0.02 || (cue.side === "left" ? x > 0 : x < 0);
        cueHit = layerOk && sideOk;
      }
      paint(mesh, mesh.uuid === focusId ? "select" : found || cueHit ? "finding" : null);
    });
  }, [cue, findings, focusId, gltf.scene, showBone, showMuscle, resetTick]);

  useEffect(() => {
    if (!cue) {
      arrow.visible = false;
      return;
    }
    const matches = meshesForCue(gltf.scene, cue);
    const aimed = aimSet(matches, cue.side).filter((mesh) => meshCenterX(mesh) !== 0 || matches.length === 1);
    const box = new THREE.Box3();
    for (const mesh of aimed.length > 0 ? aimed : matches) box.expandByObject(mesh);
    if (box.isEmpty()) {
      arrow.visible = false;
      return;
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const dir = approachDir(center, cue.approach);
    const length = THREE.MathUtils.clamp(radius * 0.7, 0.16, 0.28);
    const tip = center.clone().add(dir.clone().multiplyScalar(Math.max(radius * 0.25, 0.02)));
    const tail = tip.clone().add(dir.clone().multiplyScalar(length));
    arrow.position.copy(tail);
    arrow.setDirection(tip.clone().sub(tail).normalize());
    arrow.setLength(length, length * 0.32, length * 0.16);
    arrow.setColor(new THREE.Color("#8f2d2d"));
    arrow.visible = true;
    const viewDir = dir.clone();
    if (cue.approach === "medial" || cue.approach === "lateral") viewDir.add(new THREE.Vector3(0, 0.2, 0.9)).normalize();
    if (cue.approach === "front") viewDir.add(new THREE.Vector3(0.45, 0.15, 0)).normalize();
    if (cue.approach === "back") viewDir.add(new THREE.Vector3(0.45, 0.1, 0)).normalize();
    const distance = Math.max(0.85, radius * 3.2 + 0.4);
    const place = () => {
      camera.position.copy(center.clone().add(viewDir.clone().multiplyScalar(distance)));
      const controls = get().controls as { target: THREE.Vector3; update: () => void } | null;
      if (controls?.target) {
        controls.target.copy(center);
        controls.update();
      } else {
        camera.lookAt(center);
      }
    };
    place();
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [arrow, camera, cue, get, gltf.scene, resetTick, showBone, showMuscle]);

  return (
    <group>
      <primitive
        object={gltf.scene}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          const mesh = meshOf(event.object);
          if (!mesh?.visible) return;
          if (mesh.userData.parked) {
            restoreMesh(mesh);
            justRestored.current = true;
          }
          onFocus(describe(mesh, event.point));
        }}
        onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          const mesh = meshOf(event.object);
          if (!mesh?.visible) return;
          if (justRestored.current) {
            justRestored.current = false;
            return;
          }
          if (mesh.userData.parked) return;
          shiftToFloor(mesh, pile.current);
          pile.current += 1;
          onFocus(describe(mesh, event.point));
        }}
        onPointerOver={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      />
      <primitive object={arrow} />
      {marks.map((mark) =>
        mark.surfacePoint ? (
          <mesh
            key={mark.markId}
            position={mark.surfacePoint}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(mark.markId);
            }}
          >
            <sphereGeometry args={[mark.markId === focusId ? 0.022 : 0.016, 16, 12]} />
            <meshStandardMaterial color="#f6e6e2" emissive="#8f2d2d" emissiveIntensity={1} />
          </mesh>
        ) : null,
      )}
    </group>
  );
}

function CameraSnap({ view, tick }: { view: [number, number, number]; tick: number }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as {
    target: THREE.Vector3;
    update: () => void;
    _sphericalDelta?: { set: (x: number, y: number, z: number) => void };
  } | null;
  useEffect(() => {
    if (tick === 0) return;
    camera.position.set(view[0], view[1], view[2]);
    if (controls?.target) {
      controls.target.set(0, 0.86, 0);
      controls._sphericalDelta?.set(0, 0, 0);
      controls.update();
    }
    camera.lookAt(0, 0.86, 0);
  }, [camera, controls, tick, view]);
  return null;
}

export function ModelProgress() {
  const [value, setValue] = useState(preloadValue);
  const [ready, setReady] = useState(preloadValue >= 100);
  useEffect(() => {
    const listener = (next: number, done: boolean) => {
      setValue(next);
      setReady(done);
    };
    preloadListeners.add(listener);
    listener(preloadValue, preloadValue >= 100);
    void preloadBodyModel();
    return () => {
      preloadListeners.delete(listener);
    };
  }, []);
  return (
    <div className="grid gap-2">
      <div className="h-2 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-seal transition-[width] duration-200" style={{ width: `${value}%` }} />
      </div>
      <p className="text-sm text-muted">{ready ? "解剖模型已載入。這部瀏覽器會快取，下次會快好多。" : `解剖模型載入 ${value}%`}</p>
    </div>
  );
}

export function BodyCanvas({
  marks,
  focusId,
  findings,
  cue = null,
  view,
  viewTick,
  onFocus,
  onSelect,
}: {
  marks: PainMark[];
  focusId: string | null;
  findings: MuscleFinding[];
  cue?: AnatomyCue | null;
  view: [number, number, number];
  viewTick: number;
  onFocus: (hit: BodyHit) => void;
  onSelect: (markId: string) => void;
}) {
  const [showMuscle, setShowMuscle] = useState(true);
  const [showBone, setShowBone] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const { active, progress } = useProgress();

  useEffect(() => {
    if (!cue) return;
    setShowMuscle(cue.layer !== "bone");
    setShowBone(cue.layer === "bone");
  }, [cue]);

  return (
    <div className="relative h-full" onContextMenu={(event) => event.preventDefault()}>
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2">
        <button
          type="button"
          className={`min-h-11 rounded-full border px-3 text-sm ${showMuscle ? "border-seal bg-seal text-paper" : "border-line bg-paper"}`}
          onClick={() => setShowMuscle((value) => !value)}
        >
          肌肉
        </button>
        <button
          type="button"
          className={`min-h-11 rounded-full border px-3 text-sm ${showBone ? "border-seal bg-seal text-paper" : "border-line bg-paper"}`}
          onClick={() => setShowBone((value) => !value)}
        >
          骨骼
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full border border-line bg-paper px-3 text-sm"
          onClick={() => {
            setShowMuscle(cue ? cue.layer !== "bone" : true);
            setShowBone(cue ? cue.layer === "bone" : false);
            setResetTick((value) => value + 1);
          }}
        >
          重置
        </button>
      </div>
      {active && (
        <div className="absolute right-2 bottom-2 left-2 z-10">
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
            <div className="h-full bg-seal" style={{ width: `${Math.round(progress)}%` }} />
          </div>
        </div>
      )}
      <Canvas camera={{ position: [0, 0.86, 3.35], fov: 32, near: 0.01, far: 50 }} dpr={[1, 1.75]} gl={{ antialias: true }}>
        <color attach="background" args={["#efe6d8"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[1.6, 3.2, 2.4]} intensity={1.35} />
        <directionalLight position={[-1.4, 1.5, -1.2]} intensity={0.45} />
        <CameraSnap view={view} tick={viewTick} />
        <Suspense fallback={null}>
          <Anatomy
            marks={marks}
            focusId={focusId}
            findings={findings}
            cue={cue}
            showMuscle={showMuscle}
            showBone={showBone}
            resetTick={resetTick}
            onFocus={onFocus}
            onSelect={onSelect}
          />
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan
          minDistance={0.35}
          maxDistance={6}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI / 1.55}
          target={[0, 0.86, 0]}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        />
      </Canvas>
    </div>
  );
}
