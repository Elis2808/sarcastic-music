"use client";

import { useRef, useEffect } from "react";

type Page = string;
interface NavItem { page: Page; label: string; }
interface MobileNavProps {
  items: NavItem[];
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const SPEED = 0.5; // px per frame

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const trackRef    = useRef<HTMLDivElement>(null);
  const posRef      = useRef(0);
  const halfWRef    = useRef(0);
  const rafRef      = useRef<number>(0);
  const navigateFn  = useRef(onNavigate);
  navigateFn.current = onNavigate;

  // doubled list for seamless infinite scroll
  const doubled = [...items, ...items];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => { halfWRef.current = track.scrollWidth / 2; };
    const tid = setTimeout(() => {
      measure();
      rafRef.current = requestAnimationFrame(loop);
    }, 50);

    function loop() {
      posRef.current -= SPEED;
      if (halfWRef.current > 0 && posRef.current <= -halfWRef.current) {
        posRef.current += halfWRef.current;
      }
      if (track) track.style.transform = `translateX(${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(tid);
    };
  }, []);

  function navigateByX(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const btns = track.querySelectorAll<HTMLButtonElement>("button[data-idx]");
    for (const btn of btns) {
      const r = btn.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        const idx = parseInt(btn.getAttribute("data-idx") || "0", 10);
        navigateFn.current(items[idx % items.length].page);
        return;
      }
    }
  }

  function handleClick(e: React.MouseEvent) {
    navigateByX(e.clientX);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    e.preventDefault();
    navigateByX(e.changedTouches[0].clientX);
  }

  return (
    <div
      className="sm:hidden w-full max-w-2xl rounded-full overflow-hidden relative"
      style={{
        backgroundColor: "rgba(20,20,24,0.48)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
        height: 46,
      }}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
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
              <button
                key={i}
                data-idx={i}
                style={{
                  height: "100%",
                  color: isActive ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.78)",
                  border: isActive ? "1px solid rgba(201,168,76,0.65)" : "1px solid transparent",
                  backgroundColor: isActive ? "rgb(0,0,0)" : "transparent",
                  pointerEvents: "none",
                }}
                className="px-4 rounded-full text-xs font-medium outline-none whitespace-nowrap flex-shrink-0 flex items-center"
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
