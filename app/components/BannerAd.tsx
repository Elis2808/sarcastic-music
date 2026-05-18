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
      style={{ width, height, overflow: "hidden", flexShrink: 0 }}
      className={className}
    />
  );
}
