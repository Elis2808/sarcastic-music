"use client";

import { useState, useRef, useCallback } from "react";

type KeyResult = {
  key: string;
  scale: string;
  strength: number;
  relativeKey: string;
  relativeScale: string;
};

const KEY_COLORS: Record<string, string> = {
  C:    "#e74c3c",
  "C#": "#e67e22", "D♭": "#e67e22",
  D:    "#f1c40f",
  "D#": "#2ecc71", "E♭": "#2ecc71",
  E:    "#1abc9c",
  F:    "#3498db",
  "F#": "#9b59b6", "G♭": "#9b59b6",
  G:    "#e91e63",
  "G#": "#ff5722", "A♭": "#ff5722",
  A:    "#00bcd4",
  "A#": "#8bc34a", "B♭": "#8bc34a",
  B:    "#ff9800",
};

async function detectKey(file: File): Promise<KeyResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/detect-key", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Key detection failed");
  }
  return res.json();
}

export default function KeyFinder() {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<KeyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError("");
    setResult(null);
    setFileName(file.name);
    try {
      const res = await detectKey(file);
      setResult(res);
    } catch (e) {
      console.error(e);
      setError("Could not detect key. Make sure it's a valid audio file.");
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
      e.target.value = ""; // reset so same file can be re-selected
    }
  }, [processFile]);

  const color = result ? (KEY_COLORS[result.key] ?? "#C9A84C") : "#C9A84C";
  const strengthPct = result ? Math.round(result.strength * 100) : 0;

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 select-none max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Key Finder</h1>

      {/* Drop zone */}
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
          {dragging ? "Drop It!" : "Drop An Audio File To Detect The Song Key"}
        </p>
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <svg className="animate-spin w-8 h-8 text-[#C9A84C]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-gray-400 text-sm">Analysing <span className="text-white">{fileName}</span>…</p>
        </div>
      )}

      {/* Error */}
      {error && <p className="mt-6 text-red-400 text-sm">{error}</p>}

      {/* Result */}
      {result && !loading && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-gray-500 text-xs uppercase tracking-widest">Detected Key</p>

          {/* Big key display */}
          <div
            className="w-40 h-40 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-500"
            style={{ backgroundColor: color + "22", border: `3px solid ${color}`, boxShadow: `0 0 40px ${color}55` }}
          >
            <span className="text-5xl font-bold" style={{ color }}>{result.key}</span>
            <span className="text-lg text-white mt-1 capitalize">{result.scale}</span>
          </div>

          {/* Relative key */}
          <p className="text-gray-400 text-sm">
            Relative key:{" "}
            <span className="font-semibold text-white">
              {result.relativeKey} <span className="capitalize">{result.relativeScale}</span>
            </span>
          </p>

          {/* Confidence bar */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Confidence</span>
              <span>{strengthPct}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${strengthPct}%`, backgroundColor: color }}
              />
            </div>
          </div>

          <p className="text-gray-500 text-xs mt-1">{fileName}</p>

          <button
            onClick={() => { setResult(null); setFileName(""); }}
            className="mt-2 px-4 py-2 rounded-lg bg-black border border-gray-700 hover:border-[#C9A84C] text-gray-400 hover:text-white text-xs transition-all duration-200 outline-none focus:ring-2 focus:ring-[#C9A84C]"
          >
            Analyse another file
          </button>
        </div>
      )}
    </div>
  );
}
