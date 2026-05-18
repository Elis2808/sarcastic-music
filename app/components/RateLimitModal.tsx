"use client";

let listeners: ((tool: string, limit: number) => void)[] = [];

export function showRateLimitModal(tool: string, limit: number) {
  listeners.forEach(l => l(tool, limit));
}

import { useEffect, useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  rhyme: "Rhyme Finder",
  define: "Dictionary",
  separate: "Song Splitter",
  "detect-key": "Key Finder",
  "detect-bpm": "BPM Finder",
  "convert-file": "File Converter",
  master: "Audio Master",
  youtube: "Downloader",
};

const TOOL_LIMITS: Record<string, number> = {
  rhyme: 200,
  define: 200,
  separate: 10,
  "detect-key": 50,
  "detect-bpm": 50,
  "convert-file": 70,
  master: 40,
  youtube: 20,
};

export default function RateLimitModal() {
  const [visible, setVisible] = useState(false);
  const [tool, setTool] = useState("");
  const [limit, setLimit] = useState(0);

  useEffect(() => {
    const handler = (t: string, l: number) => {
      setTool(t);
      setLimit(l);
      setVisible(true);
    };
    listeners.push(handler);
    return () => { listeners = listeners.filter(l => l !== handler); };
  }, []);

  if (!visible) return null;

  const toolLabel = TOOL_LABELS[tool] || tool;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={() => setVisible(false)}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-8 flex flex-col items-center text-center gap-4"
        style={{
          backgroundColor: "rgb(10,10,12)",
          border: "1px solid rgba(201,168,76,0.35)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(201,168,76,0.1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
          style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)" }}
        >
          🎵
        </div>

        {/* Title */}
        <div>
          <p className="text-gray-400 text-sm mb-1">{limit} / {limit} uses — {toolLabel}</p>
          <h2 className="text-white text-xl font-bold leading-snug">
            Thank you for using Sarcastic Music!
          </h2>
        </div>

        {/* Message */}
        <p className="text-gray-400 text-sm leading-relaxed">
          Your free daily uses for <span className="text-[#C9A84C] font-semibold">{toolLabel}</span> have been used up. We hope to see you again tomorrow!
        </p>

        {/* Divider */}
        <div className="w-full h-px" style={{ background: "rgba(201,168,76,0.15)" }} />

        {/* CTA placeholder */}
        <p className="text-gray-600 text-xs italic">
          Subscription plans coming soon — unlimited access for power users.
        </p>

        {/* OK button */}
        <button
          onClick={() => setVisible(false)}
          className="mt-2 px-8 py-2.5 rounded-full font-semibold text-sm transition-all"
          style={{
            background: "rgba(201,168,76,0.12)",
            border: "1px solid rgba(201,168,76,0.45)",
            color: "#C9A84C",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,168,76,0.22)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(201,168,76,0.12)")}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
