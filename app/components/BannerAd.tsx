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
        clearInterval(interval);
        inject();
      }
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
