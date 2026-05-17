"use client";

import { useRef, useState } from "react";

type Page = string;

interface NavItem {
  page: Page;
  label: string;
}

interface MobileNavProps {
  items: NavItem[];
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export default function MobileNav({ items, activePage, onNavigate }: MobileNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(0);
  const didDrag = useRef(false);

  return (
    <div className="sm:hidden w-full mb-6">
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          gap: 6px;
          width: max-content;
          animation: marquee 22s linear infinite;
        }
        .marquee-paused {
          animation-play-state: paused !important;
        }
      `}</style>

      {/* Scrollable outer — lets user swipe natively */}
      <div
        ref={scrollRef}
        className="overflow-x-auto px-2"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          didDrag.current = false;
          setPaused(true);
        }}
        onTouchMove={(e) => {
          if (Math.abs(e.touches[0].clientX - touchStartX.current) > 4) {
            didDrag.current = true;
          }
        }}
        onTouchEnd={() => {
          setPaused(false);
        }}
      >
        <div className={`marquee-track${paused ? " marquee-paused" : ""}`}>
          {[...items, ...items].map(({ page, label }, i) => (
            <button
              key={i}
              onTouchEnd={(e) => {
                e.stopPropagation();
                if (!didDrag.current) onNavigate(page);
              }}
              style={{
                borderColor: activePage === page ? "#C9A84C" : "rgba(201,168,76,0.35)",
                background: activePage === page ? "rgba(201,168,76,0.12)" : "black",
                boxShadow: activePage === page ? "0 0 10px rgba(201,168,76,0.25)" : "none",
                transition: "background 0.2s, box-shadow 0.2s",
              }}
              className={`px-3 py-1.5 rounded-lg text-xs outline-none whitespace-nowrap border-2 flex-shrink-0 ${
                activePage === page ? "text-[#C9A84C]" : "text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
