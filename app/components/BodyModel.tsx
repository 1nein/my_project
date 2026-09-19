"use client";

/**
 * 3D 인체 모델.
 *
 * 이 컴포넌트는 **그리고 알리는 일만** 한다. 기록을 읽거나 쓰지 않는다. 어느 부위를 강조할지는
 * 바깥에서 받은 목록으로 정한다. 이 경계가 있어야 나중에 모델이나 렌더링 방식을 바꿀 때 이
 * 파일과 모델 파일만 갈아끼우면 된다.
 */

import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress } from "@react-three/drei";
import * as THREE from "three";
import {
  findBodyPart,
  sideFromLocalZ,
  type Side,
} from "@/app/lib/bodyParts";

const MODEL_URL = "/human-body.glb";

/** 이 거리 이상 움직였으면 돌리기로 본다. 손가락이 마우스보다 흔들리므로 넉넉하게 잡는다. */
const DRAG_THRESHOLD_PX = 8;

const COLOR_BASE = "#94a3b8";
const COLOR_RECORDED = "#f59e0b";
const COLOR_SELECTED = "#ef4444";

useGLTF.preload(MODEL_URL);

type BodyModelProps = {
  /** 지금 고른 부위. 가장 진하게 칠해진다. */
  selectedId?: string | null;
  /** 기록이 있는 부위. 강조색으로 칠해진다. */
  recordedIds?: string[];
  onSelect: (bodyPartId: string, side: Side) => void;
  className?: string;
};

function regionIdOf(object: THREE.Object3D): string {
  const fromExtras = object.userData?.region_id;
  return typeof fromExtras === "string" && fromExtras ? fromExtras : object.name;
}

function eachMaterial(mesh: THREE.Mesh, run: (material: THREE.Material) => void): void {
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach(run);
  } else if (mesh.material) {
    run(mesh.material);
  }
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />
      <directionalLight position={[-2, 2, -3]} intensity={0.5} />
    </>
  );
}

type SceneProps = {
  selectedId: string | null;
  recordedIds: string[];
  onSelect: (bodyPartId: string, side: Side) => void;
};

function Scene({ selectedId, recordedIds, onSelect }: SceneProps) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera } = useThree();

  /**
   * 모델 파일은 캐시되어 여러 화면이 같은 것을 쓴다. 그대로 색을 바꾸면 다른 화면까지
   * 물들고, 게다가 25개 덩어리가 재질 하나를 공유하고 있어 온몸이 함께 바뀐다.
   * 그래서 장면을 복제하고 덩어리마다 재질도 복제한다. 이 일은 한 번만 한다.
   */
  const model = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    });
    return root;
  }, [scene]);

  const frame = useMemo(() => {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) / 2;
    return { center, radius };
  }, [model]);

  // 전신이 잘리지 않도록 인체 중앙 높이를 바라본다. 바닥 원점을 보면 모델이 화면 위로 벗어난다.
  useEffect(() => {
    const { center, radius } = frame;
    camera.position.set(center.x, center.y, center.z + radius * 3.6);
    camera.lookAt(center);
  }, [camera, frame]);

  const recordedKey = recordedIds.join("|");
  const recorded = useMemo(
    () => new Set(recordedKey ? recordedKey.split("|") : []),
    [recordedKey],
  );

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const id = regionIdOf(mesh);
      const color =
        id === selectedId ? COLOR_SELECTED : recorded.has(id) ? COLOR_RECORDED : COLOR_BASE;
      eachMaterial(mesh, (material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (standard.color) standard.color.set(color);
      });
    });
  }, [model, selectedId, recorded]);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    // 가장 가까운 덩어리 하나만 처리한다. 막지 않으면 뒤쪽 덩어리까지 이어서 불린다.
    event.stopPropagation();

    /*
     * 돌리려고 드래그한 것을 선택으로 오인하지 않는다.
     *
     * `delta`는 누르기 시작한 지점부터 뗀 지점까지 포인터가 움직인 거리다. 3D 층이 직접 재
     * 주므로, 회전 조작이 포인터를 붙잡아 가도 값이 정확하다. 직접 세어 두면 그 상황에서
     * 움직임 이벤트를 놓친다.
     */
    if (event.delta > DRAG_THRESHOLD_PX) return;

    const id = regionIdOf(event.object);
    const part = findBodyPart(id);
    if (!part) return;

    // 누른 지점을 모델 자신의 좌표로 바꿔서 앞뒤를 본다. 화면이나 세계 좌표로 보면
    // 카메라를 돌렸을 때 앞뒤가 뒤바뀐다.
    const local = model.worldToLocal(event.point.clone());
    onSelect(id, sideFromLocalZ(local.z));
  }

  return (
    <>
      <Lights />
      <group onClick={handleClick}>
        <primitive object={model} />
      </group>
      <OrbitControls
        makeDefault
        target={[frame.center.x, frame.center.y, frame.center.z]}
        enablePan={false}
        minDistance={frame.radius * 1.4}
        maxDistance={frame.radius * 8}
      />
    </>
  );
}

class ModelErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadingOverlay() {
  const { active } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p className="rounded-full bg-white/85 px-4 py-2 text-sm text-slate-600 shadow-sm dark:bg-slate-900/85 dark:text-slate-300">
        인체 모델을 불러오는 중…
      </p>
    </div>
  );
}

export default function BodyModel({
  selectedId = null,
  recordedIds = [],
  onSelect,
  className,
}: BodyModelProps) {
  return (
    <div className={className}>
      <ModelErrorBoundary
        fallback={
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-600 dark:text-slate-300">
            인체 모델을 불러오지 못했습니다. 새로고침해 보시고, 계속 안 되면 아래 목록에서 부위를
            골라 주세요.
          </div>
        }
      >
        <Canvas
          className="h-full w-full touch-none"
          dpr={[1, 2]}
          camera={{ fov: 35, near: 0.01, far: 100 }}
        >
          <Suspense fallback={null}>
            <Scene selectedId={selectedId} recordedIds={recordedIds} onSelect={onSelect} />
          </Suspense>
        </Canvas>
        <LoadingOverlay />
      </ModelErrorBoundary>
    </div>
  );
}
