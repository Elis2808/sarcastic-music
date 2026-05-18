"use client";

import { useEffect, useRef } from "react";

interface BannerAdProps {
  zoneId: string;
  width: number;
  height: number;
  className?: string;
}

export default function BannerAd({ zoneId, width, height, className = "" }: BannerAdProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !ref.current) return;
    ran.current = true;
    const run = () => {
      try { (window as any).aclib?.runBanner({ zoneId }); } catch {}
    };
    if ((window as any).aclib) {
      run();
    } else {
      const t = setInterval(() => {
        if ((window as any).aclib) { clearInterval(t); run(); }
      }, 100);
    }
  }, [zoneId]);

  return (
    <div
      ref={ref}
      style={{ width, height, overflow: "hidden", flexShrink: 0 }}
      className={className}
    />
  );
}
