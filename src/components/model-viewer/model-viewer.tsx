"use client";

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Center,
  Grid,
  Loader,
  ContactShadows,
} from "@react-three/drei";
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

/**
 * Physically-based neutral gray finish applied uniformly to every uploaded
 * model, regardless of source format or any material/texture embedded in the
 * file — keeps the preview presentation consistent and reads like the
 * print-plastic the model will actually be manufactured in.
 */
function createViewerMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#c9ccd2",
    roughness: 0.45,
    metalness: 0.06,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
  });
}

function applyViewerMaterial(object: THREE.Object3D) {
  const material = createViewerMaterial();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function StlModel({ url, onMeasured }: { url: string; onMeasured: (radius: number) => void }) {
  const geometry = useLoader(STLLoader, url);
  useReportRadius(geometry, onMeasured);
  const material = useMemo(() => createViewerMaterial(), []);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

function ObjModel({ url, onMeasured }: { url: string; onMeasured: (radius: number) => void }) {
  const object = useLoader(OBJLoader, url);
  useReportRadius(object, onMeasured);
  // useLayoutEffect (not useEffect) so the override lands before the next
  // WebGL frame paints — otherwise the file's own material flashes briefly.
  useLayoutEffect(() => applyViewerMaterial(object), [object]);
  return <primitive object={object} />;
}

function ThreeMfModel({ url, onMeasured }: { url: string; onMeasured: (radius: number) => void }) {
  const object = useLoader(ThreeMFLoader, url);
  useReportRadius(object, onMeasured);
  useLayoutEffect(() => applyViewerMaterial(object), [object]);
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

/**
 * Hand-authored three-point studio rig (key/fill/rim), scaled to the model's
 * bounding radius so it reads correctly at any print size. Deliberately no
 * HDRI/environment map — that would pull an external CDN asset into a viewer
 * that otherwise has zero third-party runtime dependencies (matches the
 * dependency-free pattern used for dashboard charts elsewhere in this app).
 */
function StudioLighting({ radius }: { radius: number }) {
  const d = radius * 3;
  return (
    <>
      <hemisphereLight args={["#ffffff", "#3a3d44", 0.35]} />
      {/* Key: primary shadow-casting light, front-upper-right */}
      <directionalLight
        position={[d * 0.6, d * 0.9, d * 0.7]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={d * 4}
        shadow-camera-left={-radius * 2}
        shadow-camera-right={radius * 2}
        shadow-camera-top={radius * 2}
        shadow-camera-bottom={-radius * 2}
      />
      {/* Fill: softens key-light shadows from the opposite side, no shadow of its own */}
      <directionalLight position={[-d * 0.8, d * 0.35, d * 0.4]} intensity={0.5} color="#dfe6ff" />
      {/* Rim: backlight that separates the model's silhouette from the background */}
      <directionalLight position={[-d * 0.2, d * 0.6, -d * 0.9]} intensity={0.7} color="#ffffff" />
    </>
  );
}

/**
 * Frames the camera to the model's measured bounding radius. Replaces drei's
 * <Stage adjustCamera>, which was removed so the lighting above could be
 * hand-authored instead of relying on Stage's baked-in environment lighting.
 *
 * Takes plain refs (owned by the parent via useRef), not the camera/controls
 * returned by useThree() — mutating those directly trips the
 * react-hooks/immutability lint, since a ref's .current is the only object
 * React's hooks rules treat as safe to mutate imperatively.
 */
function AutoFrameCamera({
  radius,
  cameraRef,
  controlsRef,
}: {
  radius: number;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;

    const distance = radius * 2.8;
    camera.position.set(distance * 0.62, distance * 0.5, distance * 0.62);
    camera.near = Math.max(radius / 100, 0.01);
    camera.far = radius * 30;
    camera.updateProjectionMatrix();

    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [radius, cameraRef, controlsRef]);

  return null;
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
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
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
        <Canvas shadows dpr={[1, 2]}>
          <PerspectiveCamera ref={cameraRef} makeDefault position={[3, 2, 3]} fov={45} />
          <color attach="background" args={["#0d0e11"]} />
          <Suspense fallback={null}>
            <Center>
              <Model url={url} fileType={fileType} onMeasured={handleMeasured} />
            </Center>
            {radius !== null && (
              <>
                <StudioLighting radius={radius} />
                <AutoFrameCamera radius={radius} cameraRef={cameraRef} controlsRef={controlsRef} />
                <TechnicalFloor radius={radius} />
                <ContactShadows
                  position={[0, -radius * 1.0, 0]}
                  opacity={0.35}
                  blur={2.6}
                  far={radius * 3}
                  scale={radius * 6}
                  resolution={512}
                  color="#000000"
                />
              </>
            )}
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.1}
            minDistance={radius ? radius * 0.6 : 0.1}
            maxDistance={radius ? radius * 8 : 100}
          />
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
