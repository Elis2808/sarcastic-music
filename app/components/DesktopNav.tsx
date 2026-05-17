"use client";

import { motion } from "framer-motion";

interface Props {
  items: { page: string; label: string }[];
  activePage: string;
  onNavigate: (page: string) => void;
}

const SPRING = { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.9 };

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  return (
    <nav
      className="hidden sm:flex items-center mb-6 rounded-full px-[10px]"
      style={{
        height: 58,
        gap: 2,
        backgroundColor: "rgba(20,20,24,0.50)",
        backdropFilter: "blur(14px) saturate(160%)",
        WebkitBackdropFilter: "blur(14px) saturate(160%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
      }}
    >
      {items.map(({ page, label }) => {
        const isActive = activePage === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="relative flex items-center justify-center px-5 h-10 rounded-full outline-none whitespace-nowrap"
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              color: isActive ? "rgba(255,235,190,0.95)" : "rgba(255,255,255,0.55)",
              transition: "color 0.2s ease",
              WebkitFontSmoothing: "antialiased",
            }}
          >
            {/* Liquid glass bubble — only transform/opacity animated */}
            {isActive && (
              <motion.span
                layoutId="liquid-tab"
                transition={SPRING}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ zIndex: 0, willChange: "transform" }}
              >
                {/* LAYER 1 — Main glass body */}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.16), rgba(255,255,255,0.07))",
                    backdropFilter: "blur(10px) saturate(170%)",
                    WebkitBackdropFilter: "blur(10px) saturate(170%)",
                  }}
                />

                {/* LAYER 2 — Top reflection */}
                <span
                  className="absolute pointer-events-none"
                  style={{
                    top: 1,
                    left: "12%",
                    width: "76%",
                    height: "38%",
                    borderRadius: "50%",
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.28), rgba(255,255,255,0))",
                    filter: "blur(3px)",
                    opacity: 0.55,
                  }}
                />

                {/* LAYER 3 — Edge light */}
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
                  }}
                />

                {/* Internal luminance — subtle center brightness */}
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: "radial-gradient(circle at center, rgba(255,255,255,0.06), rgba(255,255,255,0) 70%)",
                  }}
                />
              </motion.span>
            )}

            <span className="relative" style={{ zIndex: 1 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
