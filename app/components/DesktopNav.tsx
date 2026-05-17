"use client";

import { useRef, useEffect } from "react";

interface Props {
  items: { page: string; label: string }[];
  activePage: string;
  onNavigate: (page: string) => void;
}

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const mounted = useRef(false);

  function movePill(btn: HTMLButtonElement, animated: boolean) {
    const pill = pillRef.current;
    const container = containerRef.current;
    if (!pill || !container) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const left = btnRect.left - containerRect.left;
    const width = btnRect.width;

    if (!animated) {
      pill.style.transition = "none";
      pill.style.left = `${left}px`;
      pill.style.width = `${width}px`;
      pill.style.opacity = "1";
      return;
    }

    // Water-bubble spring: squish sideways then settle
    pill.style.transition = [
      "left 0.42s cubic-bezier(0.22,1.6,0.36,1)",
      "width 0.42s cubic-bezier(0.22,1.6,0.36,1)",
      "opacity 0.18s ease",
      "transform 0.42s cubic-bezier(0.22,1.6,0.36,1)",
    ].join(", ");
    pill.style.left = `${left}px`;
    pill.style.width = `${width}px`;
    pill.style.opacity = "1";
    // Brief squish scale like a water bubble landing
    pill.style.transform = "scaleY(0.82) scaleX(1.06)";
    setTimeout(() => {
      if (pillRef.current) pillRef.current.style.transform = "scaleY(1) scaleX(1)";
    }, 80);
  }

  useEffect(() => {
    const idx = items.findIndex(i => i.page === activePage);
    const btn = btnRefs.current[idx];
    if (btn) movePill(btn, mounted.current);
    mounted.current = true;
  }, [activePage]);

  return (
    <nav
      ref={containerRef}
      className="hidden sm:flex relative items-center mb-6 rounded-full px-1 py-1"
      style={{
        backdropFilter: "blur(24px) saturate(1.6)",
        WebkitBackdropFilter: "blur(24px) saturate(1.6)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(0,0,0,0.75) 100%)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 2px 20px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08) inset",
      }}
    >
      {/* Water bubble pill */}
      <div
        ref={pillRef}
        className="absolute top-1 h-[calc(100%-8px)] rounded-full pointer-events-none overflow-hidden"
        style={{
          opacity: 0,
          backdropFilter: "blur(20px) saturate(2.5) brightness(1.2)",
          WebkitBackdropFilter: "blur(20px) saturate(2.5) brightness(1.2)",
          background: [
            "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 65%)",
            "radial-gradient(ellipse at 50% 100%, rgba(160,210,255,0.12) 0%, transparent 60%)",
            "linear-gradient(160deg, rgba(200,232,255,0.13) 0%, rgba(150,200,255,0.04) 50%, rgba(201,168,76,0.07) 100%)",
          ].join(", "),
          border: "1px solid rgba(210,235,255,0.3)",
          boxShadow: [
            "0 0 20px rgba(160,210,255,0.18)",
            "0 0 6px rgba(201,168,76,0.12)",
            "0 1.5px 0 rgba(255,255,255,0.5) inset",
            "0 -1px 0 rgba(160,210,255,0.12) inset",
          ].join(", "),
        }}
      >
        {/* Top specular — bright curved highlight like a water bubble */}
        <div className="absolute left-[15%] right-[15%] top-[2px] h-[38%] rounded-full pointer-events-none" style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.0) 100%)",
          filter: "blur(1px)",
        }} />
        {/* Side edge glints */}
        <div className="absolute left-0 top-[20%] w-[3px] h-[50%] rounded-full pointer-events-none" style={{
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.3), transparent)",
        }} />
        <div className="absolute right-0 top-[20%] w-[3px] h-[50%] rounded-full pointer-events-none" style={{
          background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.15), transparent)",
        }} />
      </div>

      {items.map(({ page, label }, idx) => {
        const isActive = activePage === page;
        return (
          <button
            key={page}
            ref={el => { btnRefs.current[idx] = el; }}
            onClick={() => onNavigate(page)}
            className="relative z-10 px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap transition-colors duration-200"
            style={{ color: isActive ? "#C9A84C" : "rgba(255,255,255,0.5)" }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
