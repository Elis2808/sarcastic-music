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
  const trackRef   = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const btnRefs    = useRef<HTMLButtonElement[]>([]);
  const allBtnRefs = useRef<{ el: HTMLButtonElement; idx: number }[]>([]);

  // position of locked overlay (left offset from container)
  const [lockLeft, setLockLeft] = useState<number | null>(null);
  const [lockWidth, setLockWidth] = useState(80);

  const autoPos    = useRef(0);
  const halfW      = useRef(0);
  const velocity   = useRef(0);

  const dragging     = useRef(false);
  const didDrag      = useRef(false);
  const dragStartX   = useRef(0);
  const dragStartY   = useRef(0);
  const dragStartPos = useRef(0);
  const lastX        = useRef(0);
  const lastT        = useRef(0);
  const hoveredIdx   = useRef(-1);

  const navigateFn  = useRef(onNavigate);
  navigateFn.current = onNavigate;
  const activeRef   = useRef(activePage);
  activeRef.current = activePage;

  const doubled = [...items, ...items];

  function nearestByScreenX(screenX: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    allBtnRefs.current.forEach(({ el, idx }) => {
      const r = el.getBoundingClientRect();
      if (screenX >= r.left && screenX <= r.right) {
        best = idx; bestDist = 0;
      } else if (bestDist > 0) {
        const dist = Math.min(Math.abs(screenX - r.left), Math.abs(screenX - r.right));
        if (dist < bestDist) { bestDist = dist; best = idx; }
      }
    });
    return best;
  }

  // Measure where the active tab's first copy sits in the container coords
  // Called after mount and after activePage changes
  function measureLock() {
    const track = trackRef.current;
    if (!track) return;
    const container = track.parentElement;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    // find first copy of active button
    const activeIdx = items.findIndex(it => it.page === activePage);
    const btn = btnRefs.current[activeIdx];
    if (!btn) return;
    const btnRect = btn.getBoundingClientRect();
    setLockLeft(btnRect.left - containerRect.left);
    setLockWidth(btnRect.width);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    autoPos.current  = 0;
    velocity.current = 0;

    const measure = () => { halfW.current = el.scrollWidth > 0 ? el.scrollWidth / 2 : 0; };
    measure();

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
        if (el) el.style.transform = `translateX(${autoPos.current}px)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    const tid = setTimeout(() => {
      measure();
      measureLock();
      rafRef.current = requestAnimationFrame(loop);
    }, 60);

    function onStart(e: TouchEvent) {
      dragging.current     = true;
      didDrag.current      = false;
      dragStartX.current   = e.touches[0].clientX;
      dragStartY.current   = e.touches[0].clientY;
      dragStartPos.current = autoPos.current;
      lastX.current        = e.touches[0].clientX;
      lastT.current        = performance.now();
      velocity.current     = 0;
    }

    function onMove(e: TouchEvent) {
      const x  = e.touches[0].clientX;
      const dx = x - dragStartX.current;
      const dy = e.touches[0].clientY - dragStartY.current;
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
      if (el) el.style.transform = `translateX(${autoPos.current}px)`;

      const nearIdx = nearestByScreenX(x);
      if (nearIdx !== null && nearIdx !== hoveredIdx.current) {
        btnRefs.current.forEach((b, i) => { if (b) b.style.transform = i === nearIdx ? "scale(1.08)" : "scale(1)"; });
        hoveredIdx.current = nearIdx;
      }
    }

    function onEnd(e: TouchEvent) {
      dragging.current   = false;
      hoveredIdx.current = -1;
      btnRefs.current.forEach(b => { if (b) b.style.transform = "scale(1)"; });
      if (!didDrag.current) {
        const x   = e.changedTouches[0].clientX;
        const idx = nearestByScreenX(x);
        if (idx !== null) navigateFn.current(items[idx].page);
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage]);

  const activeItem = items.find(it => it.page === activePage);

  return (
    <div
      className="sm:hidden w-full mb-6 rounded-full overflow-hidden relative"
      style={{
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
        height: 46,
      }}
    >
      {/* Scrolling track — all tabs including active scroll, active styled differently */}
      <div className="absolute inset-0 overflow-hidden" style={{ padding: "4px 6px" }}>
        <div
          ref={trackRef}
          className="flex gap-1 h-full"
          style={{ width: "max-content", willChange: "transform" }}
        >
          {doubled.map(({ page, label }, i) => {
            const isFirst  = i < items.length;
            const itemIdx  = i % items.length;
            const isActive = page === activePage;
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
                  color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.75)",
                  border: isActive ? "1px solid rgba(201,168,76,0.6)" : "1px solid transparent",
                  backgroundColor: isActive ? "rgb(0,0,0)" : "transparent",
                }}
                className="px-4 rounded-full text-xs font-medium outline-none whitespace-nowrap flex-shrink-0 flex items-center"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Invisible overlay on the active tab's position to intercept taps and keep it "locked" looking */}
      {activeItem && lockLeft !== null && (
        <button
          onClick={() => navigateFn.current(activeItem.page)}
          className="absolute top-0 bottom-0 rounded-full outline-none"
          style={{
            left: lockLeft,
            width: lockWidth,
            zIndex: 20,
            backgroundColor: "transparent",
            border: "none",
            cursor: "default",
          }}
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
