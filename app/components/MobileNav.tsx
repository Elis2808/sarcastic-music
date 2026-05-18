"use client";

import { useRef, useEffect } from "react";

type Page = string;
interface NavItem { page: Page; label: string; }
interface MobileNavProps {
  items: NavItem[];
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const AUTO_SPEED = 0.5;

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const trackRef   = useRef<HTMLDivElement>(null);
  const posRef     = useRef(0);
  const halfWRef   = useRef(0);
  const rafRef     = useRef<number>(0);
  const navigateFn = useRef(onNavigate);
  navigateFn.current = onNavigate;

  // touch state
  const touchStartX  = useRef(0);
  const touchStartY  = useRef(0);
  const touchStartPos = useRef(0);
  const isDragging   = useRef(false);
  const isHoriz      = useRef<boolean | null>(null); // null = undecided

  const doubled = [...items, ...items];

  function wrap(p: number) {
    const h = halfWRef.current;
    if (h <= 0) return p;
    while (p <= -h) p += h;
    while (p > 0)  p -= h;
    return p;
  }

  useEffect(() => {
    const track = trackRef.current;
    const container = track?.parentElement;
    if (!track || !container) return;

    const tid = setTimeout(() => {
      halfWRef.current = track.scrollWidth / 2;
      rafRef.current = requestAnimationFrame(loop);
    }, 50);

    function loop() {
      if (!isDragging.current) {
        posRef.current = wrap(posRef.current - AUTO_SPEED);
        if (track) track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    function onTouchStart(e: TouchEvent) {
      touchStartX.current   = e.touches[0].clientX;
      touchStartY.current   = e.touches[0].clientY;
      touchStartPos.current = posRef.current;
      isDragging.current    = false;
      isHoriz.current       = null;
    }

    function onTouchMove(e: TouchEvent) {
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      // decide direction once we have enough movement
      if (isHoriz.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        isHoriz.current = Math.abs(dx) > Math.abs(dy);
      }

      if (isHoriz.current) {
        e.preventDefault(); // block page vertical scroll only when swiping horiz
        isDragging.current = true;
        posRef.current = wrap(touchStartPos.current + dx);
        if (track) track.style.transform = `translateX(${posRef.current}px)`;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const wasDragging = isDragging.current;
      isDragging.current = false;
      isHoriz.current    = null;

      if (!wasDragging) {
        // pure tap — find which button is under the finger
        const x = e.changedTouches[0].clientX;
        const btns = track!.querySelectorAll<HTMLElement>("[data-page]");
        for (const btn of btns) {
          const r = btn.getBoundingClientRect();
          if (x >= r.left && x <= r.right) {
            const page = btn.getAttribute("data-page")!;
            navigateFn.current(page);
            return;
          }
        }
        // fallback: nearest
        let best: string | null = null;
        let bestDist = Infinity;
        for (const btn of btns) {
          const r   = btn.getBoundingClientRect();
          const mid = (r.left + r.right) / 2;
          const d   = Math.abs(x - mid);
          if (d < bestDist) { bestDist = d; best = btn.getAttribute("data-page"); }
        }
        if (best) navigateFn.current(best);
      }
    }

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove",  onTouchMove,  { passive: false });
    container.addEventListener("touchend",   onTouchEnd,   { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(tid);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove",  onTouchMove);
      container.removeEventListener("touchend",   onTouchEnd);
    };
  }, []);

  return (
    <div
      className="sm:hidden rounded-full overflow-hidden relative"
      style={{
        width: "min(92vw, 360px)",
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
        height: 46,
      }}
    >
      <div className="absolute inset-0 overflow-hidden" style={{ padding: "4px 6px" }}>
        <div
          ref={trackRef}
          className="flex gap-1 h-full"
          style={{ width: "max-content", willChange: "transform" }}
        >
          {doubled.map(({ page, label }, i) => {
            const isActive = page === activePage;
            return (
              <div
                key={i}
                data-page={page}
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 16px",
                  borderRadius: 9999,
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  fontSize: 12,
                  fontWeight: 500,
                  color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.78)",
                  border: isActive ? "1px solid rgba(201,168,76,0.65)" : "1px solid transparent",
                  backgroundColor: isActive ? "rgb(0,0,0)" : "transparent",
                  userSelect: "none",
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
