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
    const inject = () => {
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.text = `aclib.runBanner({zoneId:'${zoneId}'});`;
      ref.current!.appendChild(s);
    };
    if ((window as any).aclib) {
      inject();
    } else {
      const t = setInterval(() => {
        if ((window as any).aclib) { clearInterval(t); inject(); }
      }, 100);
    }
  }, [zoneId]);

  return (
    <div ref={ref} style={{ width, height, overflow: "hidden", flexShrink: 0 }} className={className} />
  );
}
