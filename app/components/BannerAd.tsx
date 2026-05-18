"use client";

import { useEffect, useRef } from "react";

interface AdSlotProps {
  zoneId: string;
  width: string | number;
  height: string | number;
  className?: string;
}

export default function AdSlot({ zoneId, width, height, className = "" }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    const interval = setInterval(() => {
      if (!(window as any).aclib || !ref.current) return;
      clearInterval(interval);
      if (injected.current) return;
      injected.current = true;
      ref.current.dataset.loaded = "true";
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.text = `aclib.runBanner({ zoneId: '${zoneId}' });`;
      ref.current.appendChild(s);
    }, 200);
    return () => clearInterval(interval);
  }, [zoneId]);

  return (
    <div
      ref={ref}
      style={{ width, height, overflow: "hidden", flexShrink: 0 }}
      className={className}
    />
  );
}
