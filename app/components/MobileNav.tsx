"use client";

import { useRef, useEffect } from "react";

type Page = string;

interface NavItem {
  page: Page;
  label: string;
}

interface MobileNavProps {
  items: NavItem[];
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const BASE_SPEED = 0.6; // px/frame auto-scroll

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const autoPos = useRef(0);
  const halfWidth = useRef(0);
  // drag
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPos = useRef(0);
  // momentum
  const velocity = useRef(0);          // px/frame at release
  const lastX = useRef(0);
  const lastT = useRef(0);
  const navigateFn = useRef(onNavigate);
  navigateFn.current = onNavigate;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measure = () => { halfWidth.current = el.scrollWidth / 2; };
    const t = setTimeout(measure, 100);

    function wrap(pos: number) {
      if (halfWidth.current <= 0) return pos;
      while (pos < -halfWidth.current) pos += halfWidth.current;
      while (pos > 0) pos -= halfWidth.current;
      return pos;
    }

    function loop() {
      if (!dragging.current) {
        // momentum decays toward BASE_SPEED
        if (Math.abs(velocity.current) > 0.05) {
          // velocity is negative when moving left (normal scroll direction)
          autoPos.current += velocity.current;
          // decay: blend velocity toward -BASE_SPEED
          velocity.current += (-BASE_SPEED - velocity.current) * 0.06;
        } else {
          velocity.current = 0;
          autoPos.current -= BASE_SPEED;
        }
        autoPos.current = wrap(autoPos.current);
        el!.style.transform = `translateX(${autoPos.current}px)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function onStart(e: TouchEvent) {
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
      if (Math.abs(dx) > 4) didDrag.current = true;

      // track velocity (px per ms → convert to px/frame @60fps)
      const now = performance.now();
      const dt = now - lastT.current;
      if (dt > 0) velocity.current = ((x - lastX.current) / dt) * 16;
      lastX.current = x;
      lastT.current = now;

      autoPos.current = wrap(dragStartPos.current + dx);
      el!.style.transform = `translateX(${autoPos.current}px)`;
    }

    function onEnd() {
      dragging.current = false;
      // velocity already set — loop() will decay it
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(t);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div className="sm:hidden w-full mb-6 overflow-hidden">
      <div
        ref={trackRef}
        className="flex gap-1.5 px-2"
        style={{ width: "max-content", willChange: "transform" }}
      >
        {[...items, ...items].map(({ page, label }, i) => (
          <button
            key={i}
            onTouchEnd={(e) => {
              e.stopPropagation();
              if (!didDrag.current) navigateFn.current(page);
            }}
            style={{
              borderColor: activePage === page ? "#C9A84C" : "rgba(201,168,76,0.35)",
              background: activePage === page ? "rgba(201,168,76,0.12)" : "black",
              boxShadow: activePage === page ? "0 0 10px rgba(201,168,76,0.25)" : "none",
              transition: "background 0.2s, box-shadow 0.2s",
            }}
            className={`px-3 py-1.5 rounded-lg text-xs outline-none whitespace-nowrap border-2 flex-shrink-0 ${
              activePage === page ? "text-[#C9A84C]" : "text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
