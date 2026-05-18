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
    const inject = () => {
      if (injected || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      if (rect.width === 0) return;
      injected = true;
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.text = `aclib.runBanner({ zoneId: '${zoneId}' });`;
      ref.current.appendChild(s);
    };
    const poll = setInterval(() => {
      if (!(window as any).aclib) return;
      clearInterval(poll);
      inject();
      window.addEventListener("resize", inject);
    }, 200);
    return () => {
      clearInterval(poll);
      window.removeEventListener("resize", inject);
    };
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
