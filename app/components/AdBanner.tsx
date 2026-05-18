"use client";

import { useEffect, useRef } from "react";

interface AdBannerProps {
  zoneId?: string;
  className?: string;
}

export default function AdBanner({ zoneId = "11324470", className = "" }: AdBannerProps) {
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

  return <div ref={ref} className={className} />;
}
