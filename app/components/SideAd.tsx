"use client";

import { useEffect, useRef } from "react";

interface SideAdProps {
  side: "left" | "right";
  zoneId?: string;
}

export default function SideAd({ side, zoneId = "11324470" }: SideAdProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inject = () => {
      if (!ref.current) return;
      if (ref.current.dataset.loaded) return;
      ref.current.dataset.loaded = "true";
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.text = `aclib.runBanner({ zoneId: '${zoneId}' });`;
      ref.current.appendChild(s);
    };
    const interval = setInterval(() => {
      if ((window as any).aclib && ref.current) {
        const rect = ref.current.getBoundingClientRect();
        if (rect.width === 0) return; // hidden on this screen size, keep waiting
        clearInterval(interval);
        inject();
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
