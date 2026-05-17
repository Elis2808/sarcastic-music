"use client";

import { useRef, useEffect, useCallback } from "react";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const speedRef = useRef(0.4);
  const isTouchingRef = useRef(false);
  const touchStartXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const didDragRef = useRef(false);

  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!isTouchingRef.current) {
      el.scrollLeft += speedRef.current;
      // Seamless loop — track is doubled, so reset at halfway
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  function handleTouchStart(e: React.TouchEvent) {
    isTouchingRef.current = true;
    didDragRef.current = false;
    touchStartXRef.current = e.touches[0].clientX;
    scrollStartRef.current = scrollRef.current?.scrollLeft ?? 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const el = scrollRef.current;
    if (!el) return;
    const dx = touchStartXRef.current - e.touches[0].clientX;
    if (Math.abs(dx) > 5) didDragRef.current = true;
    el.scrollLeft = scrollStartRef.current + dx;
    if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft = 0;
    if (el.scrollLeft < 0) el.scrollLeft = el.scrollWidth / 2 - 1;
  }

  function handleTouchEnd() {
    isTouchingRef.current = false;
  }

  return (
    <div className="sm:hidden w-full mb-6 overflow-hidden">
      <style>{`.nav-no-scrollbar::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={scrollRef}
        className="nav-no-scrollbar flex gap-1.5 px-2"
        style={{ overflowX: "scroll", scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {[...items, ...items].map(({ page, label }, i) => (
          <button
            key={i}
            onTouchEnd={(e) => {
              e.stopPropagation();
              if (!didDragRef.current) onNavigate(page);
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
