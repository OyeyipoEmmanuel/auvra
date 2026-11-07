"use client";

import { useEffect } from "react";

/** Eased, scroll-linked layers without intercepting wheel, keyboard, or touch scrolling. */
export function MarketingMotion() {
  useEffect(() => {
    const nativeScroll = window.matchMedia(
      "(prefers-reduced-motion: reduce), (max-width: 900px), (pointer: coarse)",
    );
    if (nativeScroll.matches) return;
    let disposed = false;
    let instance: { destroy: () => void } | null = null;
    void import("lenis").then(({ default: Lenis }) => {
      if (disposed) return;
      instance = new Lenis({
        autoRaf: true,
        anchors: true,
        lerp: 0.075,
        wheelMultiplier: 0.9,
      });
    });
    return () => {
      disposed = true;
      instance?.destroy();
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layers = [...document.querySelectorAll<HTMLElement>("[data-auvra-drift]")];
    if (!layers.length) return;
    let frame = 0;
    let running = false;
    const values = new Map<HTMLElement, number>();

    const tick = () => {
      let unsettled = false;
      for (const layer of layers) {
        const rect = layer.getBoundingClientRect();
        const target = Math.max(
          -1,
          Math.min(
            1,
            (window.innerHeight * 0.5 - (rect.top + rect.height * 0.5)) / window.innerHeight,
          ),
        );
        const current = values.get(layer) ?? target;
        const next = current + (target - current) * 0.085;
        values.set(layer, next);
        layer.style.setProperty(
          "--auvra-drift",
          `${(next * Number(layer.dataset.auvraDrift || 32)).toFixed(2)}px`,
        );
        if (Math.abs(target - next) > 0.002) unsettled = true;
      }
      if (unsettled) frame = requestAnimationFrame(tick);
      else running = false;
    };
    const schedule = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
