"use client";

import { useEffect, useRef } from "react";

interface SideAdProps {
  side: "left" | "right";
  zoneId?: string;
}

export default function SideAd({ side, zoneId = "11324470" }: SideAdProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let injected = false;
    const poll = setInterval(() => {
      if (!(window as any).aclib || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      if (rect.width === 0) return; // still hidden, keep polling
      clearInterval(poll);
      if (injected) return;
      injected = true;
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.text = `aclib.runBanner({ zoneId: '${zoneId}' });`;
      ref.current.appendChild(s);
    }, 300);
    return () => clearInterval(poll);
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
