"use client";

import { useRef, useState, useLayoutEffect } from "react";

interface Props {
  items: { page: string; label: string }[];
  activePage: string;
  onNavigate: (page: string) => void;
}

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  const navRef  = useRef<HTMLElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const activeIdx  = items.findIndex(i => i.page === activePage);
  const targetIdx  = hoveredIdx ?? activeIdx;

  // Reposition indicator whenever target changes
  useLayoutEffect(() => {
    const btn = btnRefs.current[targetIdx];
    const nav = navRef.current;
    if (!btn || !nav) return;
    const btnRect = btn.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setIndicatorStyle({
      left:    btnRect.left - navRect.left,
      width:   btnRect.width,
      opacity: 1,
    });
  }, [targetIdx, activePage]);

  return (
    <nav
      ref={navRef}
      className="hidden sm:flex items-center mb-6 rounded-full"
      onMouseLeave={() => setHoveredIdx(null)}
      style={{
        position: "relative",
        height: 58,
        gap: 2,
        padding: "6px 8px",
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.16)",
      }}
    >
      {/* Single always-rendered indicator — never mounts/unmounts */}
      <span
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          top: 6,
          height: "calc(100% - 12px)",
          left:    indicatorStyle.left,
          width:   indicatorStyle.width,
          opacity: indicatorStyle.opacity,
          transition: "left 0.32s cubic-bezier(0.25,1,0.5,1), width 0.32s cubic-bezier(0.25,1,0.5,1), opacity 0.16s ease",
          willChange: "left, width",
          zIndex: 0,
        }}
      >
        {/* Layer 1 — brightness lift */}
        <span className="absolute inset-0 rounded-full" style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.11), rgba(255,255,255,0.05))",
        }} />
        {/* Layer 2 — internal luminance */}
        <span className="absolute inset-0 rounded-full" style={{
          background: "radial-gradient(circle at center, rgba(255,255,255,0.045), rgba(255,255,255,0) 72%)",
        }} />
        {/* Layer 3 — top reflection */}
        <span className="absolute pointer-events-none" style={{
          top: 1, left: "14%", width: "72%", height: "34%",
          borderRadius: "50%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.20), rgba(255,255,255,0))",
          filter: "blur(3px)",
          opacity: 0.38,
        }} />
        {/* Layer 4 — edge separation */}
        <span className="absolute inset-0 rounded-full" style={{
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        }} />
      </span>

      {items.map(({ page, label }, idx) => {
        const isActive = activePage === page;
        const isHovered = hoveredIdx === idx;
        return (
          <button
            key={page}
            ref={el => { btnRefs.current[idx] = el; }}
            onClick={() => onNavigate(page)}
            onMouseEnter={() => setHoveredIdx(idx)}
            className="relative flex items-center justify-center px-5 h-full rounded-full outline-none whitespace-nowrap"
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              WebkitFontSmoothing: "antialiased",
              zIndex: 1,
              color: isActive
                ? "rgba(255,240,205,0.96)"
                : isHovered
                  ? "rgba(255,240,205,0.72)"
                  : "rgba(255,255,255,0.55)",
              transition: "color 0.18s ease",
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
