"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const motionFrames = {
  reveal: [
    { opacity: 0, transform: "translateY(24px)" },
    { opacity: 1, transform: "translateY(0)" },
  ],
  preview: [
    { opacity: 0, transform: "translateY(28px) scale(0.98)" },
    { opacity: 1, transform: "translateY(0) scale(1)" },
  ],
  nav: [
    { opacity: 0, transform: "translateY(-8px)" },
    { opacity: 1, transform: "translateY(0)" },
  ],
  bar: [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
};

type MotionKind = keyof typeof motionFrames;

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = root.current;
    if (!container || !window.IntersectionObserver || !Element.prototype.animate) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = Array.from(container.querySelectorAll<HTMLElement>("[data-landing-motion]"));
    const revealed = new Set<HTMLElement>();
    const animations = new Map<HTMLElement, Animation>();

    function cancelAnimations() {
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    }

    function reveal(target: HTMLElement) {
      if (preference.matches || revealed.has(target)) return;
      revealed.add(target);
      observer.unobserve(target);

      // Never fade an element the user is already interacting with.
      if (target.contains(document.activeElement)) return;

      const kind = target.dataset.landingMotion as MotionKind;
      const frames = motionFrames[kind];
      if (!frames) return;

      const animation = target.animate(frames, {
        duration: kind === "bar" ? 950 : kind === "preview" ? 800 : kind === "nav" ? 450 : 650,
        delay: Math.min(400, Math.max(0, Number(target.dataset.motionDelay) || 0)),
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      });
      animations.set(target, animation);
      animation.finished.then(
        () => animations.delete(target),
        () => animations.delete(target),
      );
    }

    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement);
      }),
      { threshold: 0.05 },
    );

    function syncMotionPreference() {
      observer.disconnect();
      cancelAnimations();
      if (preference.matches) return;

      targets.forEach((target) => {
        if (revealed.has(target)) return;
        const bounds = target.getBoundingClientRect();
        if (bounds.top < window.innerHeight - 24 && bounds.bottom > 0) {
          reveal(target);
        } else {
          observer.observe(target);
        }
      });
    }

    function showFocusedContent(event: FocusEvent) {
      if (!(event.target instanceof Node)) return;
      const focused = event.target;
      targets.forEach((target) => {
        if (!target.contains(focused)) return;
        revealed.add(target);
        observer.unobserve(target);
        animations.get(target)?.cancel();
        animations.delete(target);
      });
    }

    syncMotionPreference();
    preference.addEventListener("change", syncMotionPreference);
    container.addEventListener("focusin", showFocusedContent);
    window.addEventListener("beforeprint", cancelAnimations);

    return () => {
      observer.disconnect();
      cancelAnimations();
      preference.removeEventListener("change", syncMotionPreference);
      container.removeEventListener("focusin", showFocusedContent);
      window.removeEventListener("beforeprint", cancelAnimations);
    };
  }, []);

  // Server-rendered content stays visible if JavaScript or motion is unavailable.
  return <div ref={root}>{children}</div>;
}
