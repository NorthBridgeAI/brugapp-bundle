"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import {
  BackLink,
  ConceptChip,
  Disclaimer,
  StatusLegend,
  StatusPanel,
  type MapPick,
} from "@/components/lock-hud";
import { makeHtmlPin, makeStatusMarker } from "@/components/lock-markers";
import {
  LOCK_CHAMBERS,
  LOCK_COPY,
  liveNdwPins,
  type LockId,
} from "@/lib/lock-map";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/time";
import type { Catalog, LiveSnapshot } from "@/lib/types";

function toLocal(lat: number, lng: number, y = 28) {
  return new THREE.Vector3(
    (lng - 3.8189) * 111320 * Math.cos((51.3312 * Math.PI) / 180),
    y,
    -(111320 * (lat - 51.3312)),
  );
}

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}

function phone() {
  return window.innerWidth < 640;
}

export function DraftCOrbit({
  catalog,
  initialNow,
  initialLive,
}: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  const now = useNow(initialNow);
  const live = useLiveSnapshot(initialLive);
  const pins = liveNdwPins(live);
  const liveAt = live?.fetchedAt
    ? formatTime(new Date(live.fetchedAt))
    : formatTime(now);
  const host = useRef<HTMLDivElement>(null);
  const lockLabels = useRef<THREE.Group | null>(null);
  const pinLabels = useRef<THREE.Group | null>(null);
  const pickRef = useRef<(next: MapPick) => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState<MapPick>(null);
  pickRef.current = setPick;

  useEffect(() => {
    const root = host.current;
    if (!root) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.Fog(0x0b1220, 2200, 5200);

    const camera = new THREE.PerspectiveCamera(
      40,
      Math.max(root.clientWidth, 1) / Math.max(root.clientHeight, 1),
      1,
      9000,
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(root.clientWidth, root.clientHeight);
    root.appendChild(renderer.domElement);

    const labels = new CSS2DRenderer();
    labels.setSize(root.clientWidth, root.clientHeight);
    labels.domElement.style.position = "absolute";
    labels.domElement.style.inset = "0";
    labels.domElement.style.pointerEvents = "none";
    root.appendChild(labels.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = 0.48 * Math.PI;
    controls.minDistance = 280;
    controls.maxDistance = 4200;

    scene.add(new THREE.HemisphereLight(0xb8c4d4, 0x0b1220, 0.72));
    const sun = new THREE.DirectionalLight(0xfff1c9, 1.1);
    sun.position.set(-220, 440, 180);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(3400, 3400),
      new THREE.MeshStandardMaterial({ color: 0x152113, roughness: 0.96 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const scheldt = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 560),
      new THREE.MeshStandardMaterial({ color: 0x0e4f55, roughness: 0.32, metalness: 0.18 }),
    );
    scheldt.rotation.x = -Math.PI / 2;
    scheldt.position.set(0, 0.4, -640);
    scene.add(scheldt);

    const canal = new THREE.Mesh(
      new THREE.PlaneGeometry(230, 980),
      new THREE.MeshStandardMaterial({ color: 0x115e59, roughness: 0.28 }),
    );
    canal.rotation.x = -Math.PI / 2;
    canal.position.set(28, 0.5, 430);
    scene.add(canal);

    const locks = new THREE.Group();
    for (const chamber of LOCK_CHAMBERS) {
      const origin = toLocal(chamber.coordinates.lat, chamber.coordinates.lng, 10);
      const heading = rad(chamber.headingDeg);
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(chamber.widthM + 12, 20, chamber.lengthM + 12),
        new THREE.MeshStandardMaterial({ color: 0xd6dee8, roughness: 0.42 }),
      );
      wall.position.copy(origin);
      wall.rotation.y = -heading;
      wall.userData = { id: chamber.id };
      locks.add(wall);
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(chamber.widthM - 8, 9, chamber.lengthM - 18),
        new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          roughness: 0.18,
          metalness: 0.22,
          emissive: 0x082f49,
          emissiveIntensity: 0.18,
        }),
      );
      water.position.set(origin.x, 11, origin.z);
      water.rotation.y = -heading;
      water.userData = { id: chamber.id };
      locks.add(water);
    }
    scene.add(locks);

    const lockGroup = new THREE.Group();
    scene.add(lockGroup);
    lockLabels.current = lockGroup;
    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    pinLabels.current = pinGroup;

    const lockBox = new THREE.Box3();
    for (const chamber of LOCK_CHAMBERS) {
      lockBox.expandByPoint(toLocal(chamber.coordinates.lat, chamber.coordinates.lng, 0));
    }
    lockBox.expandByPoint(toLocal(51.336056, 3.819774, 0));
    lockBox.expandByPoint(toLocal(51.33302, 3.820414, 0));

    const fit = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (width < 80 || height < 80) return;
      renderer.setSize(width, height);
      labels.setSize(width, height);
      const compact = width < 640;
      const box = lockBox.clone();
      box.min.x -= compact ? 260 : 190;
      box.max.x += compact ? 260 : 190;
      box.min.z -= compact ? 300 : 230;
      box.max.z += compact ? 300 : 230;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      center.y = 0;
      camera.fov = compact ? 44 : 38;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const vFov = rad(camera.fov);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const dist =
        Math.max(size.z / 2 / Math.tan(vFov / 2), size.x / 2 / Math.tan(hFov / 2)) *
        (compact ? 1.22 : 1.14);
      const elev = rad(compact ? 58 : 52);
      const az = rad(6);
      camera.position.set(
        center.x + dist * Math.sin(az) * Math.cos(0.35 * elev),
        dist * Math.sin(elev),
        center.z + dist * Math.cos(az) * Math.cos(0.2 * elev) * 0.42 + 0.38 * dist,
      );
      controls.target.copy(center);
      controls.minDistance = Math.max(240, 0.45 * dist);
      controls.maxDistance = Math.max(2800, 2.2 * dist);
      controls.update();
    };
    fit();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      if (!down) return;
      const travel = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      if (travel > 8) return;
      const box = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - box.left) / box.width) * 2 - 1;
      pointer.y = -((event.clientY - box.top) / box.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(locks.children, false)[0];
      pickRef.current(hit?.object.userData.id ? { kind: "lock", id: String(hit.object.userData.id) } : null);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    window.addEventListener("resize", fit);
    const observer = new ResizeObserver(fit);
    observer.observe(root);

    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();
    setReady(true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", fit);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
      lockLabels.current = null;
      pinLabels.current = null;
    };
  }, []);

  useEffect(() => {
    const group = lockLabels.current;
    if (!group || !ready) return;
    while (group.children.length) group.remove(group.children[0]);
    const compact = phone();
    for (const chamber of LOCK_CHAMBERS) {
      const copy = LOCK_COPY[chamber.id as LockId];
      const element = makeStatusMarker({
        title: `${copy.full} — landmark, geen live NDW`,
        short: copy.full,
        fill: "#cbd5e1",
        offset: compact && chamber.id === "oostsluis" ? "left" : copy.offset,
        selected: pick?.kind === "lock" && pick.id === chamber.id,
        onClick: () => setPick({ kind: "lock", id: chamber.id }),
      });
      element.style.pointerEvents = "auto";
      const label = new CSS2DObject(element);
      const pos = toLocal(chamber.coordinates.lat, chamber.coordinates.lng, 44);
      if (chamber.id === "oostsluis") pos.x += 36;
      label.position.copy(pos);
      group.add(label);
    }
  }, [pick, ready]);

  useEffect(() => {
    const group = pinLabels.current;
    if (!group || !ready) return;
    while (group.children.length) group.remove(group.children[0]);
    for (const pin of pins) {
      const label = new CSS2DObject(
        makeHtmlPin(pin, false, pick?.kind === "ndw" && pick.id === pin.id, () =>
          setPick({ kind: "ndw", id: pin.id }),
        ),
      );
      label.element.style.pointerEvents = "auto";
      const pos = toLocal(
        pin.coordinates.lat,
        pin.coordinates.lng,
        pin.id === "buitenhaven-noord" ? 58 : 40,
      );
      if (pin.id === "buitenhaven-noord") pos.z -= 80;
      label.position.copy(pos);
      group.add(label);
    }
  }, [pins, pick, ready]);

  return (
    <div className="fixed inset-0 z-50 bg-[#05080d] text-slate-100">
      <div ref={host} className="absolute inset-0 h-full w-full" />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="pointer-events-auto flex items-start justify-between gap-2">
          <div className="min-w-0">
            <BackLink />
            <p className="mt-1 font-mono text-[10px] tracking-[0.22em] text-amber-300 uppercase">
              Noordzeesluizen · WebGL
            </p>
            <h1 className="font-serif text-xl text-slate-50 sm:text-3xl">Terneuzen</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConceptChip letter="C" />
            <p className="font-mono text-[11px] text-cyan-200">{liveAt}</p>
          </div>
        </div>
      </header>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-2">
          <StatusPanel pick={pick} pins={pins} onClose={() => setPick(null)} />
          <div className="rounded-xl border border-white/15 bg-slate-950/90 px-3 py-2 backdrop-blur-md">
            <StatusLegend />
            <Disclaimer
              text={catalog.status.disclaimer}
              liveAt={liveAt}
              stale={live?.stale}
              ok={live?.ok}
            />
          </div>
        </div>
      </div>
      {ready ? null : (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-cyan-200">
          3D laden…
        </p>
      )}
    </div>
  );
}
