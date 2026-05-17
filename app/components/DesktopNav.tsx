"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  items: { page: string; label: string }[];
  activePage: string;
  onNavigate: (page: string) => void;
}

const SPRING = { type: "spring" as const, stiffness: 380, damping: 28, mass: 0.9 };

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  return (
    <nav
      className="hidden sm:flex relative items-center mb-6 rounded-full px-1.5 py-1.5"
      style={{
        backdropFilter: "blur(40px) saturate(1.8) brightness(0.9)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8) brightness(0.9)",
        background: [
          "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        ].join(", "),
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: [
          "0 8px 32px rgba(0,0,0,0.55)",
          "0 1px 0 rgba(255,255,255,0.12) inset",
          "0 -1px 0 rgba(0,0,0,0.3) inset",
        ].join(", "),
      }}
    >
      {items.map(({ page, label }) => {
        const isActive = activePage === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="relative px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap z-10"
            style={{ color: isActive ? "#D4A843" : "rgba(255,255,255,0.42)" }}
          >
            {/* Liquid glass bubble */}
            <AnimatePresence>
              {isActive && (
                <motion.span
                  layoutId="liquid-bubble"
                  className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
                  transition={SPRING}
                  style={{
                    backdropFilter: "blur(24px) saturate(3) brightness(1.35)",
                    WebkitBackdropFilter: "blur(24px) saturate(3) brightness(1.35)",
                    background: [
                      "radial-gradient(ellipse at 50% -10%, rgba(255,255,255,0.28) 0%, transparent 60%)",
                      "radial-gradient(ellipse at 30% 50%, rgba(200,228,255,0.10) 0%, transparent 55%)",
                      "radial-gradient(ellipse at 70% 110%, rgba(160,210,255,0.08) 0%, transparent 50%)",
                      "linear-gradient(170deg, rgba(210,235,255,0.12) 0%, rgba(180,215,255,0.04) 45%, rgba(201,168,76,0.06) 100%)",
                    ].join(", "),
                    border: "1px solid rgba(220,238,255,0.28)",
                    boxShadow: [
                      "0 0 0 0.5px rgba(255,255,255,0.18) inset",
                      "0 1.5px 0 rgba(255,255,255,0.55) inset",
                      "0 -0.5px 0 rgba(160,210,255,0.15) inset",
                      "0 0 16px rgba(180,215,255,0.14)",
                      "0 0 6px rgba(201,168,76,0.1)",
                    ].join(", "),
                  }}
                >
                  {/* Primary curved specular — the key to making it look like real glass */}
                  <span
                    className="absolute pointer-events-none"
                    style={{
                      left: "12%", right: "12%", top: "1px",
                      height: "42%",
                      borderRadius: "50%",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.0) 100%)",
                      filter: "blur(0.8px)",
                    }}
                  />
                  {/* Secondary soft fill highlight */}
                  <span
                    className="absolute pointer-events-none"
                    style={{
                      left: "25%", right: "25%", top: "3px",
                      height: "28%",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.18)",
                      filter: "blur(2px)",
                    }}
                  />
                  {/* Left edge glint */}
                  <span className="absolute pointer-events-none" style={{
                    left: "1px", top: "18%", width: "2px", height: "52%",
                    borderRadius: "9999px",
                    background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
                  }} />
                  {/* Right edge glint */}
                  <span className="absolute pointer-events-none" style={{
                    right: "1px", top: "18%", width: "2px", height: "52%",
                    borderRadius: "9999px",
                    background: "linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
                  }} />
                  {/* Bottom refraction caustic */}
                  <span className="absolute pointer-events-none" style={{
                    left: "20%", right: "20%", bottom: "1px",
                    height: "30%",
                    borderRadius: "50%",
                    background: "linear-gradient(0deg, rgba(170,215,255,0.18) 0%, transparent 100%)",
                    filter: "blur(1px)",
                  }} />
                </motion.span>
              )}
            </AnimatePresence>

            {/* Label — sits above the bubble */}
            <span className="relative z-10 transition-colors duration-200" style={{
              color: isActive ? "#D4A843" : "rgba(255,255,255,0.42)",
              textShadow: isActive ? "0 0 12px rgba(212,168,67,0.4)" : "none",
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
