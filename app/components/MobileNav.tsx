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
  const posRef = useRef(0);
  const halfWidthRef = useRef(0);
  const touchingRef = useRef(false);
  const draggedRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartPosRef = useRef(0);
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    // Measure after fonts/layout settle
    const measure = () => { halfWidthRef.current = el.scrollWidth / 2; };
    measure();
    // Re-measure after a tick in case layout shifts
    const t = setTimeout(measure, 200);

    function tick() {
      if (!touchingRef.current) {
        posRef.current -= 0.5;
        if (halfWidthRef.current > 0 && posRef.current <= -halfWidthRef.current) {
          posRef.current += halfWidthRef.current;
        }
        el.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    function onTouchStart(e: TouchEvent) {
      touchingRef.current = true;
      draggedRef.current = false;
      touchStartXRef.current = e.touches[0].clientX;
      touchStartPosRef.current = posRef.current;
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - touchStartXRef.current;
      if (Math.abs(dx) > 4) draggedRef.current = true;
      posRef.current = touchStartPosRef.current + dx;
      if (halfWidthRef.current > 0) {
        if (posRef.current < -halfWidthRef.current) posRef.current += halfWidthRef.current;
        if (posRef.current > 0) posRef.current -= halfWidthRef.current;
      }
      el.style.transform = `translateX(${posRef.current}px)`;
    }

    function onTouchEnd() {
      touchingRef.current = false;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(t);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
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
              if (!draggedRef.current) navigateRef.current(page);
            }}
            style={{ borderColor: activePage === page ? "#C9A84C" : "rgba(201,168,76,0.45)" }}
            className={`px-3 py-1.5 rounded-lg text-xs outline-none whitespace-nowrap border-2 flex-shrink-0 ${
              activePage === page
                ? "bg-black text-[#C9A84C] shadow-[0_0_12px_rgba(201,168,76,0.25)]"
                : "bg-black text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
