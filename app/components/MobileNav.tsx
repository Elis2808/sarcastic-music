"use client";

import { useRef, useEffect } from "react";

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
  const rafRef   = useRef<number>(0);
  const btnRefs  = useRef<HTMLButtonElement[]>([]);

  // auto-scroll state
  const autoPos  = useRef(0);
  const halfW    = useRef(0);
  const velocity = useRef(0);

  // drag state
  const dragging     = useRef(false);
  const didDrag      = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartY   = useRef(0);
  const dragStartPos = useRef(0);
  const lastX        = useRef(0);
  const lastT        = useRef(0);
  const hoveredIdx   = useRef(-1); // DOM-driven, no React state
  const touchActive  = useRef(false); // true between touchstart and touchend

  const navigateFn   = useRef(onNavigate);
  navigateFn.current = onNavigate;
  const activeRef    = useRef(activePage);
  activeRef.current  = activePage;

  // ── no-op pill positioning (kept for touch end snap-back) ──────────
  function movePillToPage(_page: string, _animated: boolean) {
    // border-based active state — no pill element needed
  }

  // ── find which button the finger landed on by screen hit-test ──────
  // Uses actual getBoundingClientRect on all rendered buttons (both copies)
  // so it works regardless of autoPos/transform state
  const allBtnRefs = useRef<{ el: HTMLButtonElement; idx: number }[]>([]);

  function nearestByScreenX(screenX: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    allBtnRefs.current.forEach(({ el, idx }) => {
      const r = el.getBoundingClientRect();
      if (screenX >= r.left && screenX <= r.right) {
        // direct hit
        best = idx;
        bestDist = 0;
      } else if (bestDist > 0) {
        const dist = Math.min(Math.abs(screenX - r.left), Math.abs(screenX - r.right));
        if (dist < bestDist) { bestDist = dist; best = idx; }
      }
    });
    return best;
  }

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
      touchActive.current = true;
      dragging.current   = true;
      didDrag.current    = false;
      dragStartX.current = e.touches[0].clientX;
      dragStartY.current = e.touches[0].clientY;
      dragStartPos.current = autoPos.current;
      lastX.current = e.touches[0].clientX;
      lastT.current = performance.now();
      velocity.current = 0;
    }

    function onMove(e: TouchEvent) {
      const x  = e.touches[0].clientX;
      const dx = x - dragStartX.current;
      const dy = e.touches[0].clientY - dragStartY.current;
      // Only block page scroll when horizontal movement dominates
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault();
        didDrag.current = true;
      }

      const now = performance.now();
      const dt  = now - lastT.current;
      if (dt > 0) velocity.current = ((x - lastX.current) / dt) * 16;
      lastX.current = x;
      lastT.current = now;

      autoPos.current = wrap(dragStartPos.current + dx);
      el!.style.transform = `translateX(${autoPos.current}px)`;

      // highlight nearest button while dragging
      const nearIdx = nearestByScreenX(x);
      if (nearIdx !== null && nearIdx !== hoveredIdx.current) {
        btnRefs.current.forEach((b, i) => {
          if (!b) return;
          b.style.transform = i === nearIdx ? "scale(1.1)" : "scale(1)";
        });
        hoveredIdx.current = nearIdx;
      }
    }

    function onEnd(e: TouchEvent) {
      dragging.current = false;
      hoveredIdx.current = -1;
      btnRefs.current.forEach(b => { if (b) b.style.transform = "scale(1)"; });

      if (didDrag.current) {
        // swipe — just snap pill back to active page, no navigation
        movePillToPage(activeRef.current, true);
      } else {
        // pure tap — hit-test directly against screen rects of all buttons
        const x = e.changedTouches[0].clientX;
        const idx = nearestByScreenX(x);
        if (idx !== null) navigateFn.current(items[idx].page);
        movePillToPage(activeRef.current, true);
      }
      // clear flag after a tick so React synthetic handlers see it
      setTimeout(() => { touchActive.current = false; }, 0);
    }

    el.addEventListener("touchstart", onStart, { passive: true });
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
    <div
      className="sm:hidden w-full mb-6 overflow-hidden rounded-full"
      style={{
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
        height: 46,
        padding: "4px 6px",
      }}
    >
      <div
        ref={trackRef}
        className="relative flex gap-1"
        style={{ width: "max-content", willChange: "transform", height: "100%" }}
      >
        {doubled.map(({ page, label }, i) => {
          const isFirst = i < items.length;
          const itemIdx = i % items.length;
          const isActive = activePage === page;
          return (
            <button
              key={i}
              ref={el => {
                if (el) allBtnRefs.current[i] = { el, idx: itemIdx };
                if (isFirst && el) btnRefs.current[itemIdx] = el;
              }}
              style={{
                willChange: "transform",
                height: "100%",
                color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)",
                border: isActive ? "1px solid rgba(201,168,76,0.6)" : "1px solid transparent",
                backgroundColor: "transparent",
                transition: "color 160ms ease-out, border-color 160ms ease-out",
              }}
              className="relative z-10 px-4 rounded-full text-xs font-medium outline-none whitespace-nowrap flex-shrink-0 flex items-center"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
