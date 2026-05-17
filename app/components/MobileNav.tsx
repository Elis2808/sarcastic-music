"use client";

import { useRef, useEffect, useState } from "react";

type Page = string;
interface NavItem { page: Page; label: string; }
interface MobileNavProps {
  items: NavItem[];
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const BASE_SPEED = 0.6;

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef  = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);
  const btnRefs  = useRef<HTMLButtonElement[]>([]);   // first-set only (items.length)

  // auto-scroll state
  const autoPos  = useRef(0);
  const halfW    = useRef(0);
  const velocity = useRef(0);

  // drag state
  const dragging     = useRef(false);
  const didDrag      = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartPos = useRef(0);
  const lastX        = useRef(0);
  const lastT        = useRef(0);

  // hovered item while dragging
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);

  const navigateFn   = useRef(onNavigate);
  navigateFn.current = onNavigate;
  const activeRef    = useRef(activePage);
  activeRef.current  = activePage;

  // ── pill positioning ──────────────────────────────────────────────
  function movePillToBtn(btn: HTMLButtonElement, animated: boolean) {
    const pill = pillRef.current;
    if (!pill) return;
    pill.style.transition = animated
      ? "transform 0.3s cubic-bezier(0.34,1.5,0.64,1), width 0.2s ease, height 0.2s ease"
      : "none";
    pill.style.width  = `${btn.offsetWidth}px`;
    pill.style.height = `${btn.offsetHeight}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  }

  function movePillToPage(page: string, animated: boolean) {
    const idx = items.findIndex(it => it.page === page);
    const btn = btnRefs.current[idx];
    if (btn) movePillToBtn(btn, animated);
  }

  // ── find nearest button to a raw track-space X ───────────────────
  function nearestBtn(trackX: number): { btn: HTMLButtonElement; idx: number } | null {
    let best: { btn: HTMLButtonElement; idx: number } | null = null;
    let bestDist = Infinity;
    btnRefs.current.forEach((btn, idx) => {
      if (!btn) return;
      const center = btn.offsetLeft + btn.offsetWidth / 2;
      const dist = Math.abs(trackX - center);
      if (dist < bestDist) { bestDist = dist; best = { btn, idx }; }
    });
    return best;
  }

  // ── pill follows active page ──────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => movePillToPage(activePage, true), 60);
    return () => clearTimeout(id);
  }, [activePage]);

  // ── RAF loop + touch listeners ───────────────────────────────────
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measure = () => { halfW.current = el.scrollWidth / 2; };
    const tid = setTimeout(() => { measure(); movePillToPage(activeRef.current, false); }, 150);

    function wrap(p: number) {
      if (halfW.current <= 0) return p;
      while (p < -halfW.current) p += halfW.current;
      while (p > 0)             p -= halfW.current;
      return p;
    }

    function loop() {
      if (!dragging.current) {
        if (Math.abs(velocity.current) > 0.05) {
          autoPos.current += velocity.current;
          velocity.current += (-BASE_SPEED - velocity.current) * 0.06;
        } else {
          velocity.current = 0;
          autoPos.current -= BASE_SPEED;
        }
        autoPos.current = wrap(autoPos.current);
        el!.style.transform = `translateX(${autoPos.current}px)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function onStart(e: TouchEvent) {
      dragging.current   = true;
      didDrag.current    = false;
      dragStartX.current = e.touches[0].clientX;
      dragStartPos.current = autoPos.current;
      lastX.current = e.touches[0].clientX;
      lastT.current = performance.now();
      velocity.current = 0;
    }

    function onMove(e: TouchEvent) {
      e.preventDefault(); // stop page scrolling while swiping nav
      const x  = e.touches[0].clientX;
      const dx = x - dragStartX.current;
      if (Math.abs(dx) > 4) didDrag.current = true;

      const now = performance.now();
      const dt  = now - lastT.current;
      if (dt > 0) velocity.current = ((x - lastX.current) / dt) * 16;
      lastX.current = x;
      lastT.current = now;

      autoPos.current = wrap(dragStartPos.current + dx);
      el!.style.transform = `translateX(${autoPos.current}px)`;

      // move pill to nearest button while dragging
      // touchX in track space = screenX - trackRect.left - autoPos
      const trackRect = el!.getBoundingClientRect();
      const trackSpaceX = x - trackRect.left - autoPos.current;
      const nearest = nearestBtn(trackSpaceX);
      if (nearest) {
        movePillToBtn(nearest.btn, false);
        setHoveredIdx(nearest.idx);
      }
    }

    function onEnd(e: TouchEvent) {
      dragging.current = false;
      if (didDrag.current) {
        // navigate to wherever pill landed
        const trackRect = el!.getBoundingClientRect();
        const x = e.changedTouches[0].clientX;
        const trackSpaceX = x - trackRect.left - autoPos.current;
        const nearest = nearestBtn(trackSpaceX);
        if (nearest) {
          navigateFn.current(items[nearest.idx].page);
        }
      }
      setHoveredIdx(-1);
    }

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove",  onMove,  { passive: false });
    el.addEventListener("touchend",   onEnd,   { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(tid);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove",  onMove);
      el.removeEventListener("touchend",   onEnd);
    };
  }, []);

  const doubled = [...items, ...items];

  return (
    <div className="sm:hidden w-full mb-6 overflow-hidden">
      <div
        ref={trackRef}
        className="relative flex gap-1.5 px-2"
        style={{ width: "max-content", willChange: "transform" }}
      >
        {/* Gold sliding pill */}
        <div
          ref={pillRef}
          className="absolute top-0 left-0 rounded-lg pointer-events-none"
          style={{
            background: "rgba(201,168,76,0.18)",
            border: "2px solid #C9A84C",
            boxShadow: "0 0 14px rgba(201,168,76,0.45)",
          }}
        />

        {doubled.map(({ page, label }, i) => {
          const isFirst = i < items.length;
          const itemIdx = i % items.length;
          const isActive  = activePage === page;
          const isHovered = isFirst && hoveredIdx === itemIdx;
          return (
            <button
              key={i}
              ref={el => { if (isFirst && el) btnRefs.current[itemIdx] = el; }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (!didDrag.current) navigateFn.current(page);
              }}
              style={{
                transform: isHovered ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.15s ease, color 0.2s",
              }}
              className={`relative z-10 px-3 py-1.5 rounded-lg text-xs outline-none whitespace-nowrap border-2 border-transparent flex-shrink-0 ${
                isActive ? "text-[#C9A84C] font-semibold" : "text-gray-400"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
