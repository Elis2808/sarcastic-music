"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type BpmResult = {
  bpm: number;
  timeSignature: string;
  beatCount: number;
};

function bpmCategory(bpm: number): { label: string; color: string } {
  if (bpm < 70)  return { label: "Slow",    color: "#3498db" };
  if (bpm < 100) return { label: "Moderate", color: "#2ecc71" };
  if (bpm < 130) return { label: "Upbeat",   color: "#C9A84C" };
  if (bpm < 160) return { label: "Fast",     color: "#e67e22" };
  return           { label: "Very Fast",  color: "#e74c3c" };
}

export default function BpmFinder() {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<BpmResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = "btn-sweep-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @property --sweep-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes btn-sweep {
          to { --sweep-angle: 360deg; }
        }
        .btn-sweep-wrapper {
          position: relative;
          border-radius: 0.75rem;
          padding: 3px;
          background: #111;
        }
        .btn-sweep-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 0.75rem;
          padding: 3px;
          background: conic-gradient(from var(--sweep-angle), transparent 0deg, transparent 270deg, #C9A84C 310deg, #e8c96a 340deg, #C9A84C 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: btn-sweep 1.4s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError("");
    setResult(null);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/detect-bpm", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "BPM detection failed");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not detect BPM.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
      e.target.value = "";
    }
  }, [processFile]);

  const category = result ? bpmCategory(result.bpm) : null;
  const bpmDisplay = result ? Math.round(result.bpm) : 0;

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3 select-none">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">BPM Finder</h1>

      {/* Drop zone - hide when result shown */}
      {!result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full max-w-xl max-sm:h-40 h-52 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
            dragging
              ? "border-[#C9A84C] bg-[#C9A84C]/10 scale-[1.02]"
              : "border-gray-600 bg-gray-900 hover:border-[#C9A84C] hover:bg-black"
          }`}
        >
          <svg className={`w-10 h-10 transition-colors ${dragging ? "text-[#C9A84C]" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-gray-400 text-sm">
            {dragging ? "Drop It!" : "Drop An Audio File To Detect The BPM"}
          </p>
          <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="btn-sweep-wrapper">
            <div className="px-6 py-3 rounded-[10px] bg-black border border-[#C9A84C] text-[#C9A84C] text-sm font-medium">
              Analyzing File…
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="mt-6 text-red-400 text-sm">{error}</p>}

      {/* Result */}
      {result && !loading && category && (
        <div className="mt-8 flex flex-col items-center gap-5 w-full max-w-xs">
          <p className="text-gray-500 text-xs uppercase tracking-widest">Detected Tempo</p>

          {/* BPM circle with gold spinning effect */}
          <div className="btn-sweep-wrapper p-[3px] rounded-full">
            <div
              className="w-44 h-44 rounded-full flex flex-col items-center justify-center bg-black transition-all duration-500"
            >
              <span className="text-5xl font-bold text-[#C9A84C]">{bpmDisplay}</span>
              <span className="text-sm text-gray-300 mt-1">BPM</span>
            </div>
          </div>

          {/* Category badge - gold themed */}
          <span className="px-4 py-1 rounded-full text-sm font-medium bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/50">
            {category.label}
          </span>

          {/* Stats */}
          <div className="w-full grid grid-cols-2 gap-3">
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-xs mb-1">Time Signature</p>
              <p className="text-white font-semibold">{result.timeSignature}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-3 text-center">
              <p className="text-gray-500 text-xs mb-1">Beats Detected</p>
              <p className="text-white font-semibold">{result.beatCount}</p>
            </div>
          </div>

          <p className="text-gray-600 text-xs">{fileName}</p>

          <div className="btn-sweep-wrapper">
            <button
              onClick={() => { setResult(null); setFileName(""); }}
              className="px-4 py-2 rounded-[10px] bg-black border border-[#C9A84C] hover:bg-gray-900 text-white text-xs font-medium transition-all duration-200 outline-none"
            >
              Analyze another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
