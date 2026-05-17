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

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  // auto-scroll position (0 → -halfWidth, then wraps)
  const autoPos = useRef(0);
  const halfWidth = useRef(0);
  // drag state
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPos = useRef(0);
  const navigateFn = useRef(onNavigate);
  navigateFn.current = onNavigate;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measure = () => { halfWidth.current = el.scrollWidth / 2; };
    const t = setTimeout(measure, 100);

    function loop() {
      if (!dragging.current) {
        autoPos.current -= 0.6;
        if (halfWidth.current > 0 && autoPos.current <= -halfWidth.current) {
          autoPos.current += halfWidth.current;
        }
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
    }

    function onMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - dragStartX.current;
      if (Math.abs(dx) > 4) didDrag.current = true;
      // offset autoPos by drag delta — keeps looping seamlessly
      autoPos.current = dragStartPos.current + dx;
      // keep in loop bounds
      if (halfWidth.current > 0) {
        while (autoPos.current < -halfWidth.current) autoPos.current += halfWidth.current;
        while (autoPos.current > 0) autoPos.current -= halfWidth.current;
      }
      el!.style.transform = `translateX(${autoPos.current}px)`;
    }

    function onEnd() {
      dragging.current = false;
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
