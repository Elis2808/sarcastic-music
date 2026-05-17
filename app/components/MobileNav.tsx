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

const SPEED = 0.5; // px per frame

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const posRef = useRef(0);          // current translateX (negative = scrolled right)
  const halfWidthRef = useRef(0);    // half of track width (loop point)
  const touchStartXRef = useRef(0);
  const touchStartPosRef = useRef(0);
  const isTouchingRef = useRef(false);
  const didDragRef = useRef(false);

  const applyTransform = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${posRef.current}px)`;
    }
  }, []);

  const tick = useCallback(() => {
    if (!isTouchingRef.current) {
      posRef.current -= SPEED;
      // Seamless loop: when we've scrolled half the track, jump back to 0
      if (halfWidthRef.current > 0 && posRef.current <= -halfWidthRef.current) {
        posRef.current += halfWidthRef.current;
      }
      applyTransform();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [applyTransform]);

  useEffect(() => {
    // Measure half-width after mount
    if (trackRef.current) {
      halfWidthRef.current = trackRef.current.scrollWidth / 2;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  function onTouchStart(e: React.TouchEvent) {
    isTouchingRef.current = true;
    didDragRef.current = false;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartPosRef.current = posRef.current;
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartXRef.current;
    if (Math.abs(dx) > 4) didDragRef.current = true;
    posRef.current = touchStartPosRef.current + dx;
    // Keep in bounds for loop
    if (halfWidthRef.current > 0) {
      if (posRef.current < -halfWidthRef.current) posRef.current += halfWidthRef.current;
      if (posRef.current > 0) posRef.current -= halfWidthRef.current;
    }
    applyTransform();
  }

  function onTouchEnd() {
    isTouchingRef.current = false;
  }

  return (
    <div className="sm:hidden w-full mb-6 overflow-hidden">
      <div
        ref={trackRef}
        className="flex gap-1.5 px-2 will-change-transform"
        style={{ width: "max-content" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
