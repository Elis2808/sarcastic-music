"use client";

import { useEffect, useRef } from "react";

interface SideAdProps {
  side: "left" | "right";
  zoneId?: string;
}

export default function SideAd({ side, zoneId = "11324470" }: SideAdProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window === "undefined") return;
      if ((window as any).aclib && ref.current) {
        clearInterval(interval);
        if (ref.current.dataset.loaded) return;
        ref.current.dataset.loaded = "true";
        (window as any).aclib.runBanner({ zoneId });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [zoneId]);

  return (
    <div
      ref={ref}
      className="hidden xl:block"
      style={{
        position: "fixed",
        top: "50%",
        transform: "translateY(-50%)",
        [side]: 0,
        width: 160,
        height: 600,
        zIndex: 10,
        overflow: "hidden",
      }}
    />
  );
}
