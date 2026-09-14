import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { LOCK_FRAME, complexFitBounds, lockFitBounds } from "./lock-map";

function sizeOf(map: MapLibreMap) {
  const box = map.getContainer().getBoundingClientRect();
  return { width: box.width, height: box.height };
}

function fitLock(map: MapLibreMap) {
  const { width, height } = sizeOf(map);
  if (width < 80 || height < 80) return;
  map.resize();
  const phone = width < 640;
  const padTop = Math.min(120, Math.max(64, 0.16 * height));
  const padBottom = Math.min(132, Math.max(72, 0.18 * height));
  const padSide = Math.min(88, Math.max(40, 0.12 * width));
  if (padTop + padBottom > 0.5 * height || 2 * padSide > 0.5 * width) {
    map.jumpTo({
      center: LOCK_FRAME.center,
      zoom: phone ? 13.95 : 14.75,
      bearing: LOCK_FRAME.bearing,
      pitch: 0,
    });
    return;
  }
  map.fitBounds(lockFitBounds(), {
    padding: { top: padTop, bottom: padBottom, left: padSide, right: padSide },
    bearing: LOCK_FRAME.bearing,
    maxZoom: phone ? 14.45 : 15.15,
    duration: 0,
  });
}

/** Auto-fit the sluiscomplex until the user pans, zooms, or pinches. */
export function watchLockMapSize(map: MapLibreMap) {
  let touched = false;
  const mark = () => {
    touched = true;
  };
  const canvas = map.getCanvas();
  canvas.addEventListener("pointerdown", mark, { passive: true });
  canvas.addEventListener("wheel", mark, { passive: true });
  canvas.addEventListener("touchstart", mark, { passive: true });

  const sync = () => {
    const { width, height } = sizeOf(map);
    if (width < 80 || height < 80) return;
    map.resize();
    if (!touched) fitLock(map);
  };

  const observer = new ResizeObserver(() => sync());
  observer.observe(map.getContainer());
  const frame = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(sync);
  });
  map.once("idle", sync);

  return () => {
    window.cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener("pointerdown", mark);
    canvas.removeEventListener("wheel", mark);
    canvas.removeEventListener("touchstart", mark);
  };
}

/** Fit the Draft C complex (three sluizen + both NDW bars). Padding follows HUD chrome. */
export function watchComplexMapSize(
  map: MapLibreMap,
  paddingOf: () => PaddingOptions,
) {
  let touched = false;
  const mark = () => {
    touched = true;
  };
  const canvas = map.getCanvas();
  canvas.addEventListener("pointerdown", mark, { passive: true });
  canvas.addEventListener("wheel", mark, { passive: true });
  canvas.addEventListener("touchstart", mark, { passive: true });

  const sync = () => {
    const { width, height } = sizeOf(map);
    if (width < 80 || height < 80) return;
    map.resize();
    if (touched) return;
    const phone = width < 640;
    const padding = paddingOf();
    const top = Math.max(72, padding.top ?? 0);
    const bottom = Math.max(8, padding.bottom ?? 0);
    const left = Math.max(16, padding.left ?? 0);
    const right = Math.max(16, padding.right ?? 0);
    if (top + bottom > 0.58 * height || left + right > 0.55 * width) {
      map.jumpTo({
        center: LOCK_FRAME.center,
        zoom: phone ? 13.15 : 13.65,
        bearing: LOCK_FRAME.bearing,
        pitch: 0,
      });
      return;
    }
    map.fitBounds(complexFitBounds(phone), {
      padding: { top, bottom, left, right },
      bearing: LOCK_FRAME.bearing,
      maxZoom: phone ? 14.05 : 14.45,
      duration: 0,
    });
  };

  const observer = new ResizeObserver(() => sync());
  observer.observe(map.getContainer());
  const frame = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(sync);
  });
  map.once("idle", sync);

  return {
    refit: sync,
    disconnect: () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", mark);
      canvas.removeEventListener("wheel", mark);
      canvas.removeEventListener("touchstart", mark);
    },
  };
}
