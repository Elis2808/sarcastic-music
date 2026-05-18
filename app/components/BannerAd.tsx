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
    const fire = () => {
      if (!ref.current) return;
      if (ref.current.dataset.loaded) return;
      ref.current.dataset.loaded = "true";
      (window as any).aclib.runBanner({ zoneId });
    };
    const interval = setInterval(() => {
      if ((window as any).aclib && ref.current) {
        clearInterval(interval);
        fire();
      }
    }, 200);
    // also try on window load in case aclib loads late
    window.addEventListener("load", () => {
      if ((window as any).aclib && ref.current && !ref.current.dataset.loaded) fire();
    });
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
