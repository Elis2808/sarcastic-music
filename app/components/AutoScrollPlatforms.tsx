"use client";

import { useRef, useEffect } from "react";

interface Platform { id: string; label: string; }

interface Props {
  platforms: Platform[];
  selected: string;
  onSelect: (id: string) => void;
}

const BASE_SPEED = 0.5;

export default function AutoScrollPlatforms({ platforms, selected, onSelect }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const autoPos  = useRef(0);
  const halfW    = useRef(0);
  const velocity = useRef(0);
  const dragging     = useRef(false);
  const didDrag      = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartPos = useRef(0);
  const lastX        = useRef(0);
  const lastT        = useRef(0);
  const touchActive  = useRef(false);

  const doubled = [...platforms, ...platforms];

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const tid = setTimeout(() => { halfW.current = el.scrollWidth / 2; }, 150);

    function wrap(p: number) {
      if (halfW.current <= 0) return p;
      while (p < -halfW.current) p += halfW.current;
      while (p > 0) p -= halfW.current;
      return p;
    }

    function loop() {
      if (!dragging.current) {
        if (Math.abs(velocity.current) > 0.05) {
          autoPos.current += velocity.current;
          velocity.current += (-BASE_SPEED - velocity.current) * 0.06;
        } else {
          velocity.current = 0;
          autoPos.current -= BASE_SPEED;
        }
        autoPos.current = wrap(autoPos.current);
        if (el) el.style.transform = `translateX(${autoPos.current}px)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function onStart(e: TouchEvent) {
      touchActive.current = true;
      dragging.current = true;
      didDrag.current = false;
      dragStartX.current = e.touches[0].clientX;
      dragStartPos.current = autoPos.current;
      lastX.current = e.touches[0].clientX;
      lastT.current = performance.now();
      velocity.current = 0;
    }

    function onMove(e: TouchEvent) {
      const x = e.touches[0].clientX;
      const dx = x - dragStartX.current;
      if (Math.abs(dx) > 8) { e.preventDefault(); didDrag.current = true; }
      const now = performance.now();
      const dt = now - lastT.current;
      if (dt > 0) velocity.current = ((x - lastX.current) / dt) * 16;
      lastX.current = x;
      lastT.current = now;
      autoPos.current = wrap(dragStartPos.current + dx);
      if (el) el.style.transform = `translateX(${autoPos.current}px)`;
    }

    function onEnd(e: TouchEvent) {
      dragging.current = false;
      if (!didDrag.current) {
        const x = e.changedTouches[0].clientX;
        const els = el ? Array.from(el.querySelectorAll<HTMLButtonElement>("button")) : [];
        let best: HTMLButtonElement | null = null;
        let bestDist = Infinity;
        els.forEach(b => {
          const r = b.getBoundingClientRect();
          if (x >= r.left && x <= r.right) { best = b; bestDist = 0; }
          else if (bestDist > 0) {
            const d = Math.min(Math.abs(x - r.left), Math.abs(x - r.right));
            if (d < bestDist) { bestDist = d; best = b; }
          }
        });
        if (best) (best as HTMLButtonElement).click();
      }
      setTimeout(() => { touchActive.current = false; }, 0);
    }

    // ── Mouse drag (desktop) ────────────────────────────────────────
    function onMouseDown(e: MouseEvent) {
      dragging.current = true;
      didDrag.current = false;
      dragStartX.current = e.clientX;
      dragStartPos.current = autoPos.current;
      lastX.current = e.clientX;
      lastT.current = performance.now();
      velocity.current = 0;
      e.preventDefault();
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const dx = e.clientX - dragStartX.current;
      if (Math.abs(dx) > 4) didDrag.current = true;
      const now = performance.now();
      const dt = now - lastT.current;
      if (dt > 0) velocity.current = ((e.clientX - lastX.current) / dt) * 16;
      lastX.current = e.clientX;
      lastT.current = now;
      autoPos.current = wrap(dragStartPos.current + dx);
      if (el) el.style.transform = `translateX(${autoPos.current}px)`;
    }

    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
    }

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove",  onMove,  { passive: false });
    el.addEventListener("touchend",   onEnd,   { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(tid);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
    };
  }, []);

  return (
    <div
      className="w-full mb-3 overflow-hidden rounded-full select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        height: 40,
        padding: "3px 5px",
      }}
    >
      <div
        ref={trackRef}
        className="relative flex gap-1"
        style={{ width: "max-content", willChange: "transform", height: "100%" }}
      >
        {doubled.map((p, i) => {
          const isActive = selected === p.id;
          return (
            <button
              key={i}
              onClick={(e) => { if (didDrag.current) { e.preventDefault(); return; } onSelect(p.id === selected ? "" : p.id); }}
              style={{
                height: "100%",
                color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)",
                border: isActive ? "1px solid rgba(201,168,76,0.6)" : "1px solid transparent",
                backgroundColor: "transparent",
                transition: "color 160ms ease-out, border-color 160ms ease-out",
              }}
              className="px-4 rounded-full text-xs font-medium outline-none whitespace-nowrap flex-shrink-0 flex items-center"
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
