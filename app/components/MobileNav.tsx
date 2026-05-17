"use client";

import { useRef, useState } from "react";

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
  const touchStartXRef = useRef(0);
  const didDragRef = useRef(false);
  const [paused, setPaused] = useState(false);
  // dragOffset shifts the track while user drags
  const dragOffsetRef = useRef(0);
  const animOffsetRef = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    didDragRef.current = false;
    touchStartXRef.current = e.touches[0].clientX;
    setPaused(true);
    // capture current anim translateX so drag starts from there
    const el = trackRef.current;
    if (el) {
      const matrix = window.getComputedStyle(el).transform;
      const match = matrix.match(/matrix.*\((.+)\)/);
      if (match) {
        const vals = match[1].split(", ");
        animOffsetRef.current = parseFloat(vals[4]) || 0;
      }
      dragOffsetRef.current = animOffsetRef.current;
      el.style.transform = `translateX(${dragOffsetRef.current}px)`;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartXRef.current;
    if (Math.abs(dx) > 5) didDragRef.current = true;
    const el = trackRef.current;
    if (!el) return;
    dragOffsetRef.current = animOffsetRef.current + dx;
    el.style.transform = `translateX(${dragOffsetRef.current}px)`;
  }

  function handleTouchEnd() {
    setPaused(false);
  }

  // Calculate the width for animation — half the track (since list is doubled)
  // We use a CSS variable set via inline style on the track
  return (
    <div className="sm:hidden w-full mb-6 overflow-hidden">
      <style>{`
        @keyframes mobile-nav-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .mobile-nav-track {
          display: flex;
          gap: 6px;
          width: max-content;
          animation: mobile-nav-scroll 20s linear infinite;
        }
        .mobile-nav-track.paused {
          animation-play-state: paused;
        }
      `}</style>
      <div
        ref={trackRef}
        className={`mobile-nav-track px-2${paused ? " paused" : ""}`}
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
