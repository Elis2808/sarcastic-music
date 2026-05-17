"use client";

import { motion } from "framer-motion";

interface Props {
  items: { page: string; label: string }[];
  activePage: string;
  onNavigate: (page: string) => void;
}

const SPRING = { type: "spring" as const, stiffness: 340, damping: 30, mass: 0.8 };

export default function DesktopNav({ items, activePage, onNavigate }: Props) {
  return (
    <nav
      className="hidden sm:flex relative items-center mb-6 rounded-full px-2 py-2"
      style={{
        /* ── Container: 5-layer liquid glass dock ── */
        position: "relative",
        height: 56,

        /* Layer 1: base dark translucent */
        backgroundColor: "rgba(18,18,20,0.55)",

        /* Layer 2+3: glass overlay + subtle top reflection */
        backgroundImage: [
          "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0.04))",
        ].join(", "),

        /* Layer 4: inner light edge */
        border: "1px solid rgba(255,255,255,0.12)",

        /* Layer 5: ambient shadow + top/bottom inset edge lights */
        boxShadow: [
          "0 8px 30px rgba(0,0,0,0.35)",
          "inset 0 1px 0 rgba(255,255,255,0.18)",
          "inset 0 -1px 0 rgba(255,255,255,0.05)",
        ].join(", "),

        /* Refraction blur */
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
      }}
    >
      {items.map(({ page, label }) => {
        const isActive = activePage === page;
        return (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="relative flex items-center justify-center px-5 h-full rounded-full outline-none whitespace-nowrap z-10"
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: isActive ? "rgba(255,215,140,0.95)" : "rgba(255,255,255,0.58)",
              transition: "color 0.22s ease",
            }}
          >
            {/* ── Liquid Glass Bubble ── */}
            {isActive && (
              <motion.span
                layoutId="lg-bubble"
                transition={SPRING}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ zIndex: 0 }}
              >
                {/* LAYER 1 — Base glass with refraction */}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.10) 100%)",
                    backdropFilter: "blur(18px) saturate(200%)",
                    WebkitBackdropFilter: "blur(18px) saturate(200%)",
                  }}
                />

                {/* LAYER 2 — Top curved specular highlight */}
                <span
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    top: 2,
                    left: "10%",
                    width: "80%",
                    height: "40%",
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.65), rgba(255,255,255,0))",
                    filter: "blur(1.5px)",
                    opacity: 0.7,
                    borderRadius: "50%",
                  }}
                />

                {/* LAYER 3 — Edge rim lighting + depth shadow */}
                <span
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    boxShadow: [
                      "inset 0 1px 1px rgba(255,255,255,0.35)",
                      "0 0 0 1px rgba(255,220,140,0.10)",
                      "0 4px 12px rgba(0,0,0,0.18)",
                    ].join(", "),
                  }}
                />

                {/* LAYER 4 — Side edge glints */}
                <span className="absolute pointer-events-none" style={{
                  left: 1, top: "15%", width: 2, height: "55%", borderRadius: 9999,
                  background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.32), transparent)",
                }} />
                <span className="absolute pointer-events-none" style={{
                  right: 1, top: "15%", width: 2, height: "55%", borderRadius: 9999,
                  background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.14), transparent)",
                }} />

                {/* LAYER 5 — Bottom caustic refraction tint */}
                <span className="absolute pointer-events-none" style={{
                  left: "18%", right: "18%", bottom: 2,
                  height: "28%", borderRadius: "50%",
                  background: "linear-gradient(0deg, rgba(255,220,140,0.10) 0%, transparent 100%)",
                  filter: "blur(2px)",
                }} />
              </motion.span>
            )}

            {/* Label above bubble */}
            <span className="relative" style={{ zIndex: 1 }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
