"use client";

import { useEffect, useRef } from "react";

interface SideAdProps {
  side: "left" | "right";
  zoneId?: string;
}

export default function SideAd({ side, zoneId = "11324470" }: SideAdProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !ref.current) return;
    ran.current = true;
    const run = () => {
      try {
        (window as any).aclib?.runBanner({ zoneId });
      } catch {}
    };
    if ((window as any).aclib) {
      run();
    } else {
      const interval = setInterval(() => {
        if ((window as any).aclib) {
          clearInterval(interval);
          run();
        }
      }, 100);
    }
  }, [zoneId]);

  return (
    <div
      ref={ref}
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
      className="hidden xl:block"
    />
  );
}
