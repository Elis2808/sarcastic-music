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

    const tryInject = () => {
      if (injected || !ref.current || !(window as any).aclib) return;
      if (window.innerWidth < 1280) return;
      injected = true;
      ref.current.style.display = "block";
      const s = document.createElement("script");
      s.type = "text/javascript";
      s.text = `aclib.runBanner({ zoneId: '${zoneId}' });`;
      ref.current.appendChild(s);
    };

    // poll until aclib ready + wide enough
    const poll = setInterval(() => {
      if (!(window as any).aclib) return;
      clearInterval(poll);
      tryInject();
    }, 200);

    window.addEventListener("resize", tryInject);
    return () => {
      clearInterval(poll);
      window.removeEventListener("resize", tryInject);
    };
  }, [zoneId]);

  return (
    <div
      ref={ref}
      style={{
        display: "none", // JS will show via injected ad
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
