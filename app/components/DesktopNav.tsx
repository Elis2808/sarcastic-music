"use client";

import { useRef, useEffect, useState } from "react";

interface NavItem { page: string; label: string; icon?: React.ReactNode; }
interface Props {
  items: NavItem[];
  activePage: string;
  onNavigate: (page: string) => void;
}

// lerp helper
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  const navRef      = useRef<HTMLElement>(null);
  const btnRefs     = useRef<(HTMLButtonElement | null)[]>([]);
  const activeRef   = useRef<HTMLSpanElement>(null);
  const hoverRef    = useRef<HTMLSpanElement>(null);
  const rafRef      = useRef<number>(0);

  // RAF-driven state (no React re-renders in the loop)
  const state = useRef({
    // active indicator — snaps instantly on page change
    aLeft: 0, aWidth: 0,
    // hover indicator — lerps toward target
    hLeft: 0, hWidth: 0, hOpacity: 0,
    // lerp target
    targetLeft: 0, targetWidth: 0, targetOpacity: 0,
    // velocity tracking for opacity damping
    prevLeft: 0, velocity: 0,
    isHovering: false,
  });

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hoveredIdxRef = useRef<number | null>(null);
  const activeIdxRef  = useRef(0);

  // Update active indicator immediately on page change (no lerp)
  useEffect(() => {
    const idx = items.findIndex(i => i.page === activePage);
    activeIdxRef.current = idx;
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return;
    const br = btn.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    const left = br.left - nr.left;
    const width = br.width;
    state.current.aLeft  = left;
    state.current.aWidth = width;
    if (activeRef.current) {
      activeRef.current.style.left    = `${left}px`;
      activeRef.current.style.width   = `${width}px`;
      activeRef.current.style.opacity = "1";
    }
    // If not hovering, reset hover to active position so it starts from the right place
    if (!state.current.isHovering) {
      state.current.hLeft  = left;
      state.current.hWidth = width;
      state.current.targetLeft  = left;
      state.current.targetWidth = width;
    }
  }, [activePage]);

  // RAF loop — lerps hover indicator with inertia + velocity-based opacity
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    function tick() {
      const s = state.current;
      const LERP   = 0.09;  // low = more inertia, heavier feel
      const OLERPD = 0.06;  // opacity lerp down (slow ramp-in)
      const OLERPU = 0.08;  // opacity lerp up (slightly faster fade-out)

      // Position lerp
      const prevLeft  = s.hLeft;
      s.hLeft  = lerp(s.hLeft,  s.targetLeft,  LERP);
      s.hWidth = lerp(s.hWidth, s.targetWidth, LERP);

      // Velocity = how fast indicator is moving
      s.velocity = Math.abs(s.hLeft - prevLeft);

      // Reduce opacity during fast movement (velocity damping)
      const velocityPenalty = Math.min(s.velocity * 0.18, 0.28);
      const targetOp = s.isHovering
        ? Math.max(0, s.targetOpacity - velocityPenalty)
        : 0;

      const oLerp = targetOp > s.hOpacity ? OLERPD : OLERPU;
      s.hOpacity = lerp(s.hOpacity, targetOp, oLerp);

      // Apply to DOM directly — no React state
      const el = hoverRef.current;
      if (el) {
        el.style.left    = `${s.hLeft}px`;
        el.style.width   = `${s.hWidth}px`;
        el.style.opacity = `${s.hOpacity}`;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function handleMouseEnter(idx: number) {
    const btn = btnRefs.current[idx];
    const nav = navRef.current;
    if (!btn || !nav) return;
    const br = btn.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    state.current.targetLeft    = br.left - nr.left;
    state.current.targetWidth   = br.width;
    state.current.targetOpacity = 0.72; // hover = 72% of active — anticipation not commitment
    state.current.isHovering    = true;
    hoveredIdxRef.current = idx;
    setHoveredIdx(idx);
  }

  function handleMouseLeave() {
    state.current.targetOpacity = 0;
    state.current.isHovering    = false;
    hoveredIdxRef.current = null;
    setHoveredIdx(null);
  }

  return (
    <nav
      ref={navRef}
      className="hidden sm:flex items-center mb-6 rounded-full"
      onMouseLeave={handleMouseLeave}
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
        overflow: "hidden",
      }}
    >
      {/* ── Ambient breathing layer — subconscious luminance variation ── */}
      <span aria-hidden className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <span className="absolute rounded-full" style={{
          width: "55%", height: "160%", top: "-30%", left: "8%",
          background: "radial-gradient(circle, rgba(255,255,255,0.028) 0%, transparent 70%)",
          animation: "navBreath1 13s ease-in-out infinite",
        }} />
        <span className="absolute rounded-full" style={{
          width: "45%", height: "140%", top: "-20%", left: "42%",
          background: "radial-gradient(circle, rgba(255,255,255,0.022) 0%, transparent 70%)",
          animation: "navBreath2 17s ease-in-out infinite",
          animationDelay: "-6s",
        }} />
        <span className="absolute rounded-full" style={{
          width: "40%", height: "130%", top: "-15%", right: "5%",
          background: "radial-gradient(circle, rgba(201,168,76,0.018) 0%, transparent 70%)",
          animation: "navBreath3 11s ease-in-out infinite",
          animationDelay: "-3s",
        }} />
      </span>

      {/* ── Active indicator — snaps to active tab, no lerp ── */}
      <span
        ref={activeRef}
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          top: 6, height: "calc(100% - 12px)",
          left: 0, width: 0, opacity: 0,
          zIndex: 1,
          transition: "left 0.28s cubic-bezier(0.4,0,0.2,1), width 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <span className="absolute inset-0 rounded-full" style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.11), rgba(255,255,255,0.05))",
        }} />
        <span className="absolute inset-0 rounded-full" style={{
          background: "radial-gradient(circle at center, rgba(255,255,255,0.045), rgba(255,255,255,0) 72%)",
        }} />
        <span className="absolute pointer-events-none" style={{
          top: 1, left: "14%", width: "72%", height: "34%",
          borderRadius: "50%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0))",
          filter: "blur(3px)", opacity: 0.35,
        }} />
        <span className="absolute inset-0 rounded-full" style={{
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        }} />
      </span>

      {/* ── Hover indicator — RAF lerp with inertia ── */}
      <span
        ref={hoverRef}
        aria-hidden
        className="absolute rounded-full pointer-events-none"
        style={{
          top: 6, height: "calc(100% - 12px)",
          left: 0, width: 0, opacity: 0,
          zIndex: 2,
        }}
      >
        <span className="absolute inset-0 rounded-full" style={{
          background: "linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
        }} />
        <span className="absolute inset-0 rounded-full" style={{
          border: "1px solid rgba(255,255,255,0.05)",
        }} />
      </span>

      {/* ── Tab buttons ── */}
      {items.map(({ page, label, icon }, idx) => {
        const isActive  = activePage === page;
        const isHovered = hoveredIdx === idx;
        return (
          <button
            key={page}
            ref={el => { btnRefs.current[idx] = el; }}
            onClick={() => onNavigate(page)}
            onMouseEnter={() => handleMouseEnter(idx)}
            className="relative flex items-center justify-center gap-1.5 px-5 h-full rounded-full outline-none whitespace-nowrap"
            style={{
              fontSize: 13, fontWeight: 500,
              letterSpacing: "-0.015em",
              WebkitFontSmoothing: "antialiased",
              zIndex: 3,
              color: isActive
                ? "rgba(255,240,205,0.96)"
                : isHovered
                  ? "rgba(255,255,255,0.72)"
                  : "rgba(255,255,255,0.55)",
              transition: "color 0.2s ease-out",
            }}
          >
            {icon && (
              <span style={{
                display: "flex", alignItems: "center",
                color: isActive ? "#C9A84C" : "rgba(255,255,255,0.45)",
                transition: "color 0.22s ease-out",
              }}>
                {icon}
              </span>
            )}
            {label}
          </button>
        );
      })}

      {/* Keyframes injected once */}
      <style>{`
        @keyframes navBreath1 {
          0%,100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.12); opacity: 0.6; }
        }
        @keyframes navBreath2 {
          0%,100% { transform: scale(1.05); opacity: 0.7; }
          50%      { transform: scale(0.92); opacity: 1; }
        }
        @keyframes navBreath3 {
          0%,100% { transform: scale(0.95); opacity: 0.8; }
          50%      { transform: scale(1.08); opacity: 0.55; }
        }
      `}</style>
    </nav>
  );
}
