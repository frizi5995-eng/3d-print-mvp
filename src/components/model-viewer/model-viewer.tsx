"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Stage, Center, Grid, Loader } from "@react-three/drei";
import { STLLoader, OBJLoader, ThreeMFLoader } from "three-stdlib";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { RotateCcw, Maximize, Minimize, TriangleAlert } from "lucide-react";
import type { ModelFileType } from "@/types";

function boundingRadiusOf(object: THREE.Object3D | THREE.BufferGeometry): number {
  if (object instanceof THREE.BufferGeometry) {
    if (!object.boundingSphere) object.computeBoundingSphere();
    return object.boundingSphere?.radius || 1;
  }
  const box = new THREE.Box3().setFromObject(object);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  return sphere.radius || 1;
}

function useReportRadius(
  object: THREE.Object3D | THREE.BufferGeometry,
  onMeasured: (radius: number) => void
) {
  const radius = useMemo(() => boundingRadiusOf(object), [object]);
  useEffect(() => onMeasured(radius), [radius, onMeasured]);
}

function StlModel({ url, onMeasured }: { url: string; onMeasured: (radius: number) => void }) {
  const geometry = useLoader(STLLoader, url);
  useReportRadius(geometry, onMeasured);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#c7ccd6" roughness={0.55} metalness={0.08} />
    </mesh>
  );
}

function ObjModel({ url, onMeasured }: { url: string; onMeasured: (radius: number) => void }) {
  const object = useLoader(OBJLoader, url);
  useReportRadius(object, onMeasured);
  return <primitive object={object} />;
}

function ThreeMfModel({ url, onMeasured }: { url: string; onMeasured: (radius: number) => void }) {
  const object = useLoader(ThreeMFLoader, url);
  useReportRadius(object, onMeasured);
  return <primitive object={object} />;
}

function Model({
  url,
  fileType,
  onMeasured,
}: {
  url: string;
  fileType: ModelFileType;
  onMeasured: (radius: number) => void;
}) {
  if (fileType === "stl") return <StlModel url={url} onMeasured={onMeasured} />;
  if (fileType === "obj") return <ObjModel url={url} onMeasured={onMeasured} />;
  return <ThreeMfModel url={url} onMeasured={onMeasured} />;
}

function TechnicalFloor({ radius }: { radius: number }) {
  return (
    <Grid
      position={[0, -radius * 1.02, 0]}
      args={[radius * 10, radius * 10]}
      cellSize={radius / 8}
      cellThickness={0.4}
      cellColor="#262b33"
      sectionSize={radius * 2}
      sectionThickness={0.7}
      sectionColor="#333a45"
      fadeDistance={radius * 9}
      fadeStrength={1.5}
      infiniteGrid
    />
  );
}

class ViewerErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <TriangleAlert className="size-6" />
          Couldn&apos;t preview this model, but it was uploaded successfully.
        </div>
      );
    }
    return this.props.children;
  }
}

export function ModelViewer({
  url,
  fileType,
  filename,
  fileSize,
}: {
  url: string;
  fileType: ModelFileType;
  filename?: string;
  fileSize?: number;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleMeasured = useCallback((r: number) => setRadius(r), []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapperRef.current?.requestFullscreen();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="relative h-full min-h-80 w-full overflow-hidden rounded-2xl border border-border bg-[#0d0e11] data-[fullscreen=true]:rounded-none"
    >
      {(filename || fileSize) && (
        <div className="absolute top-3 left-3 z-10 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs backdrop-blur">
          {filename && <p className="max-w-48 truncate font-medium text-foreground">{filename}</p>}
          {fileSize !== undefined && (
            <p className="text-muted-foreground">{(fileSize / (1024 * 1024)).toFixed(2)} MB</p>
          )}
        </div>
      )}

      <ViewerErrorBoundary>
        <Canvas shadows camera={{ position: [3, 2, 3], fov: 45 }} dpr={[1, 2]}>
          <color attach="background" args={["#0d0e11"]} />
          <Suspense fallback={null}>
            <Stage adjustCamera intensity={0.7} environment={null} shadows={false} preset="soft">
              <Center>
                <Model url={url} fileType={fileType} onMeasured={handleMeasured} />
              </Center>
            </Stage>
            {radius && <TechnicalFloor radius={radius} />}
          </Suspense>
          <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} />
        </Canvas>
      </ViewerErrorBoundary>

      <Loader
        containerStyles={{ background: "#0d0e11" }}
        innerStyles={{ background: "#1d2128", width: 120, height: 2 }}
        barStyles={{ background: "#5b6cff" }}
        dataStyles={{ color: "#a5acb8", fontFamily: "inherit", fontSize: "0.7rem" }}
      />

      <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-background/80 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => controlsRef.current?.reset()}
          title="Reset view"
          aria-label="Reset view"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}
