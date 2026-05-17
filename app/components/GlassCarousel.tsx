"use client";

import { useRef, useState } from "react";

const PLACEHOLDER_CARDS = [
  { id: 1, title: "Coming Soon", subtitle: "Drop 1" },
  { id: 2, title: "Coming Soon", subtitle: "Drop 2" },
  { id: 3, title: "Coming Soon", subtitle: "Drop 3" },
  { id: 4, title: "Coming Soon", subtitle: "Drop 4" },
  { id: 5, title: "Coming Soon", subtitle: "Drop 5" },
];

export default function GlassCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [dragged, setDragged] = useState(false);

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX - (trackRef.current?.offsetLeft ?? 0);
    scrollLeft.current = trackRef.current?.scrollLeft ?? 0;
    setDragged(false);
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !trackRef.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    if (Math.abs(walk) > 4) setDragged(true);
    trackRef.current.scrollLeft = scrollLeft.current - walk;
  }

  function onMouseUp() { isDragging.current = false; }

  return (
    <div className="hidden sm:block w-full max-w-5xl mx-auto mb-6 px-4 select-none">
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        className="flex gap-4 overflow-x-auto pb-2 cursor-grab active:cursor-grabbing"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {PLACEHOLDER_CARDS.map((card) => (
          <div
            key={card.id}
            className="relative flex-shrink-0 w-52 h-72 rounded-2xl overflow-hidden bg-black"
            style={{
              backdropFilter: "blur(16px) saturate(1.6)",
              WebkitBackdropFilter: "blur(16px) saturate(1.6)",
              border: "1px solid rgba(201,168,76,0.35)",
              boxShadow: "0 0 18px rgba(201,168,76,0.12), 0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            {/* Specular top highlight */}
            <div
              className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
              style={{ background: "linear-gradient(180deg, rgba(201,168,76,0.08) 0%, transparent 100%)" }}
            />
            {/* Placeholder image area */}
            <div className="w-full h-40 bg-white/5 flex items-center justify-center">
              <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            {/* Text */}
            <div className="p-4">
              <p className="text-[#C9A84C] text-xs font-semibold uppercase tracking-widest mb-1">{card.subtitle}</p>
              <p className="text-white text-lg font-bold">{card.title}</p>
            </div>
            {/* Bottom edge shine */}
            <div
              className="absolute inset-x-0 bottom-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
