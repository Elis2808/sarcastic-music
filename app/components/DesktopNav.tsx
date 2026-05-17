"use client";

import { useRef, useEffect, useState } from "react";

interface Props {
  items: { page: string; label: string }[];
  activePage: string;
  onNavigate: (page: string) => void;
}

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

  function movePill(btn: HTMLButtonElement, animated: boolean) {
    const pill = pillRef.current;
    const container = containerRef.current;
    if (!pill || !container) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    pill.style.transition = animated ? "left 0.25s cubic-bezier(0.34,1.4,0.64,1), width 0.25s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s" : "none";
    pill.style.left = `${btnRect.left - containerRect.left}px`;
    pill.style.width = `${btnRect.width}px`;
    pill.style.opacity = "1";
  }

  // Move pill to active page on mount + page change
  useEffect(() => {
    const idx = items.findIndex(i => i.page === activePage);
    const btn = btnRefs.current[idx];
    if (btn) movePill(btn, true);
  }, [activePage]);

  // On hover move pill, on leave return to active
  function handleMouseEnter(idx: number) {
    setHovered(idx);
    const btn = btnRefs.current[idx];
    if (btn) movePill(btn, true);
  }

  function handleMouseLeave() {
    setHovered(null);
    const idx = items.findIndex(i => i.page === activePage);
    const btn = btnRefs.current[idx];
    if (btn) movePill(btn, true);
  }

  return (
    <nav
      ref={containerRef}
      onMouseLeave={handleMouseLeave}
      className="hidden sm:flex relative items-center gap-0 mb-6 rounded-full px-1 py-1"
      style={{
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.7) 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.1) inset",
      }}
    >
      {/* Sliding liquid glass pill */}
      <div
        ref={pillRef}
        className="absolute top-1 h-[calc(100%-8px)] rounded-full pointer-events-none overflow-hidden"
        style={{
          opacity: 0,
          backdropFilter: "blur(16px) saturate(2.2) brightness(1.15)",
          WebkitBackdropFilter: "blur(16px) saturate(2.2) brightness(1.15)",
          background: "linear-gradient(135deg, rgba(200,230,255,0.18) 0%, rgba(180,220,255,0.06) 40%, rgba(201,168,76,0.10) 100%)",
          border: "1px solid rgba(200,230,255,0.35)",
          boxShadow: "0 0 18px rgba(180,220,255,0.2), 0 0 8px rgba(201,168,76,0.15), 0 1px 0 rgba(255,255,255,0.45) inset, 0 -1px 0 rgba(180,220,255,0.1) inset",
        }}
      >
        {/* Ice/water specular streak */}
        <div className="absolute inset-x-2 top-0 h-[40%] rounded-full pointer-events-none" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.0) 100%)",
        }} />
        {/* Bottom refraction */}
        <div className="absolute inset-x-4 bottom-0 h-[25%] rounded-full pointer-events-none" style={{
          background: "linear-gradient(0deg, rgba(180,220,255,0.15) 0%, transparent 100%)",
        }} />
      </div>

      {items.map(({ page, label }, idx) => {
        const isActive = activePage === page;
        const isHov = hovered === idx;
        return (
          <button
            key={page}
            ref={el => { btnRefs.current[idx] = el; }}
            onClick={() => onNavigate(page)}
            onMouseEnter={() => handleMouseEnter(idx)}
            className="relative z-10 px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap transition-colors duration-150"
            style={{
              color: isActive || isHov ? "#C9A84C" : "rgba(255,255,255,0.55)",
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
