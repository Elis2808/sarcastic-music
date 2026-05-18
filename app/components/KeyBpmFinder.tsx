"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addHistoryItem } from "../lib/history";
import { addRecentFile } from "../lib/recentFiles";
import UrlDropZone from "./UrlDropZone";
import { showToast } from "./Toast";
import { showRateLimitModal } from "./RateLimitModal";

const PLATFORMS = [
  { id: "youtube",     label: "YouTube",     placeholder: "Paste YouTube URL" },
  { id: "soundcloud",  label: "SoundCloud",  placeholder: "Paste SoundCloud URL" },
  { id: "spotify",     label: "Spotify",     placeholder: "Paste Spotify URL" },
  { id: "instagram",   label: "Instagram",   placeholder: "Paste Instagram URL" },
  { id: "tiktok",      label: "TikTok",      placeholder: "Paste TikTok URL" },
  { id: "twitter",     label: "Twitter/X",   placeholder: "Paste Twitter URL" },
  { id: "facebook",    label: "Facebook",    placeholder: "Paste Facebook URL" },
];

function scrollToCenter(btn: HTMLButtonElement) {
  const c = btn.parentElement;
  if (!c) return;
  c.scrollTo({ left: btn.offsetLeft - c.offsetWidth / 2 + btn.offsetWidth / 2, behavior: "smooth" });
}

const KEY_COLORS: Record<string, string> = {
  C: "#e74c3c", "C#": "#e67e22", "D♭": "#e67e22",
  D: "#f1c40f", "D#": "#2ecc71", "E♭": "#2ecc71",
  E: "#1abc9c", F: "#3498db",
  "F#": "#9b59b6", "G♭": "#9b59b6",
  G: "#e91e63", "G#": "#ff5722", "A♭": "#ff5722",
  A: "#00bcd4", "A#": "#8bc34a", "B♭": "#8bc34a",
  B: "#ff9800",
};

function bpmCategory(bpm: number) {
  if (bpm < 60)  return { label: "Very Slow", color: "#64b5f6" };
  if (bpm < 90)  return { label: "Slow",      color: "#81c784" };
  if (bpm < 120) return { label: "Moderate",  color: "#C9A84C" };
  if (bpm < 150) return { label: "Fast",      color: "#ff8a65" };
  return               { label: "Very Fast",  color: "#e57373" };
}

type KeyResult = { key: string; scale: string; strength: number; relativeKey: string; relativeScale: string };
type BpmResult = { bpm: number; timeSignature: string; beatCount: number };

export default function KeyBpmFinder() {
  const [dragging, setDragging]       = useState(false);
  const [linkUrl, setLinkUrl]         = useState("");
  const [linkMode, setLinkMode]       = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");

  const [loading, setLoading]         = useState(false);
  const [keyResult, setKeyResult]     = useState<KeyResult | null>(null);
  const [bpmResult, setBpmResult]     = useState<BpmResult | null>(null);
  const [error, setError]             = useState("");
  const [fileName, setFileName]       = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Inject sweep style once
  useEffect(() => {
    const id = "btn-sweep-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @property --sweep-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        @keyframes btn-sweep { to { --sweep-angle: 360deg; } }
        .btn-sweep-wrapper { position: relative; border-radius: 9999px; padding: 3px; background: #111; }
        .btn-sweep-wrapper::before {
          content: ''; position: absolute; inset: 0; border-radius: 9999px; padding: 3px;
          background: conic-gradient(from var(--sweep-angle), transparent 0deg, transparent 270deg, #C9A84C 310deg, #e8c96a 340deg, #C9A84C 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: btn-sweep 1.4s linear infinite;
        }
        .circle-sweep-wrapper { position: relative; display: inline-block; border-radius: 50%; padding: 3px; background: #111; line-height: 0; }
        .circle-sweep-wrapper::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%; padding: 3px;
          background: conic-gradient(from var(--sweep-angle), transparent 0deg, transparent 270deg, #C9A84C 310deg, #e8c96a 340deg, #C9A84C 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: btn-sweep 1.4s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  async function runBoth(file: File, name: string) {
    setLoading(true);
    setError("");
    setKeyResult(null);
    setBpmResult(null);
    setFileName(name);

    const [keyRes, bpmRes] = await Promise.allSettled([
      (async () => {
        const fd = new FormData(); fd.append("file", file);
        const r = await fetch("/api/detect-key", { method: "POST", body: fd });
        if (r.status === 429) { showRateLimitModal("detect-key", 50); throw new Error("rate_limit"); }
        if (!r.ok) throw new Error("Key detection failed");
        return r.json() as Promise<KeyResult>;
      })(),
      (async () => {
        const fd = new FormData(); fd.append("file", file);
        const r = await fetch("/api/detect-bpm", { method: "POST", body: fd });
        if (r.status === 429) { showRateLimitModal("detect-bpm", 50); throw new Error("rate_limit"); }
        if (!r.ok) throw new Error("BPM detection failed");
        return r.json() as Promise<BpmResult>;
      })(),
    ]);

    setLoading(false);

    if (keyRes.status === "fulfilled") setKeyResult(keyRes.value);
    if (bpmRes.status === "fulfilled") setBpmResult(bpmRes.value);

    const keyOk = keyRes.status === "fulfilled";
    const bpmOk = bpmRes.status === "fulfilled";

    if (!keyOk && !bpmOk) {
      setError("Detection failed. Make sure it's a valid audio file.");
      return;
    }

    const kv = keyOk ? keyRes.value : null;
    const bv = bpmOk ? bpmRes.value : null;

    addHistoryItem({
      type: "key_detect",
      title: name,
      details: [kv ? `Key: ${kv.key} ${kv.scale}` : null, bv ? `BPM: ${Math.round(bv.bpm)}` : null].filter(Boolean).join(" · "),
    });
    addRecentFile({ name, type: file.type || "audio/mpeg", size: file.size, tool: "key" });
  }

  const processFile = useCallback(async (file: File) => {
    await runBoth(file, file.name);
  }, []);

  const processLink = useCallback(async () => {
    if (!linkUrl.trim()) return;
    setLoading(true);
    setError("");
    setKeyResult(null);
    setBpmResult(null);
    setFileName(linkUrl);
    try {
      const audioRes = await fetch("/api/fetch-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });
      if (!audioRes.ok) {
        const err = await audioRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch audio");
      }
      const blob = await audioRes.blob();
      const file = new File([blob], "audio.mp3", { type: "audio/mpeg" });
      setLoading(false);
      await runBoth(file, linkUrl);
    } catch (e: any) {
      setLoading(false);
      if (e.message !== "rate_limit") showToast("Invalid link. Update and try again.", "error");
    }
  }, [linkUrl]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { processFile(file); e.target.value = ""; }
  }, [processFile]);

  const hasResults = keyResult || bpmResult;
  const category = bpmResult ? bpmCategory(bpmResult.bpm) : null;
  const keyColor = keyResult ? (KEY_COLORS[keyResult.key] ?? "#C9A84C") : "#C9A84C";
  const strengthPct = keyResult ? Math.round(keyResult.strength * 100) : 0;

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3 select-none">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">Key + BPM</h1>
      <p className="text-gray-500 text-xs mb-4">Detect key and tempo simultaneously.</p>

      {/* Mode toggle */}
      {!hasResults && !loading && (
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setLinkMode(false)} className={`text-sm transition-all duration-200 cursor-pointer ${!linkMode ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}>File</button>
          <div onClick={() => setLinkMode(l => !l)} className="relative w-12 h-2.5 rounded-full bg-gray-700 cursor-pointer">
            <span className={`absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-[#C9A84C] transition-transform duration-75 pointer-events-none ${linkMode ? "translate-x-9" : "translate-x-0"}`} />
          </div>
          <button onClick={() => setLinkMode(true)} className={`text-sm transition-all duration-200 cursor-pointer ${linkMode ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}>Link</button>
        </div>
      )}

      {/* Platform selector */}
      {!hasResults && !loading && linkMode && (
        <div className="w-full max-w-xl mb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ backgroundColor: "rgba(20,20,24,0.48)", backdropFilter: "blur(14px) saturate(160%)", WebkitBackdropFilter: "blur(14px) saturate(160%)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9999, padding: "4px 6px" }}>
            {PLATFORMS.map((p) => {
              const isActive = selectedPlatform === p.id;
              return (
                <button key={p.id} onClick={(e) => { setSelectedPlatform(p.id); scrollToCenter(e.currentTarget); }} style={{ backgroundColor: "transparent", color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)", border: "1px solid " + (isActive ? "rgba(201,168,76,0.6)" : "transparent"), transition: "color 160ms ease-out, border-color 160ms ease-out" }} className="px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap flex-shrink-0">
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Link input */}
      {!hasResults && !loading && linkMode && (
        <div className="w-full max-w-xl mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") processLink(); }}
                placeholder={selectedPlatform ? PLATFORMS.find(p => p.id === selectedPlatform)?.placeholder || "Paste link here" : "Paste audio URL (YouTube, SoundCloud, etc.)"}
                className="w-full px-4 pr-12 py-3 rounded-full bg-black text-white text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] placeholder-gray-500"
                style={{ border: "1px solid rgba(201,168,76,0.25)" }}
              />
              <svg onClick={processLink} className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 hover:text-[#C9A84C] cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <button onClick={processLink} disabled={!linkUrl.trim() || loading} className="px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 hover:border-[#C9A84C] hover:bg-gray-700 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed outline-none">
              Analyze
            </button>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {!hasResults && !loading && !linkMode && (
        <UrlDropZone onUrlDrop={(url) => { setLinkUrl(url); setLinkMode(true); const p = PLATFORMS.find(pl => url.toLowerCase().includes(pl.id)); if (p) setSelectedPlatform(p.id); showToast("URL dropped! Click Analyze.", "info"); }} className="w-full max-w-xl">
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} className={`w-full max-sm:h-40 h-52 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${dragging ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-[#C9A84C]/40 bg-black hover:border-[#C9A84C]"}`}>
            <svg className={`w-10 h-10 transition-colors ${dragging ? "text-[#C9A84C]" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-gray-400 text-sm text-center px-4">{dragging ? "Drop It!" : "Drop Audio File or URL — Detect Key & BPM Together"}</p>
            <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.aiff,.aif,.wma,.opus,.mp4" className="hidden" onChange={onFileChange} />
          </div>
        </UrlDropZone>
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

      {/* Results side by side */}
      {hasResults && !loading && (
        <div className="mt-8 w-full max-w-xl flex flex-col items-center gap-6">
          <div className="w-full grid grid-cols-2 gap-4 max-sm:grid-cols-2">

            {/* Key card */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-widest">Key</p>
              {keyResult ? (
                <>
                  <div className="circle-sweep-wrapper">
                    <div className="w-24 h-24 max-sm:w-20 max-sm:h-20 rounded-full flex flex-col items-center justify-center bg-black">
                      <span className="text-2xl max-sm:text-xl font-bold" style={{ color: keyColor }}>{keyResult.key}</span>
                      <span className="text-xs text-white mt-0.5 capitalize">{keyResult.scale}</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs text-center">Relative: <span className="text-white font-medium">{keyResult.relativeKey} <span className="capitalize">{keyResult.relativeScale}</span></span></p>
                  <div className="w-full">
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Confidence</span><span>{strengthPct}%</span></div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#C9A84C] transition-all duration-700" style={{ width: `${strengthPct}%` }} />
                    </div>
                  </div>
                  <button onClick={async () => { try { await navigator.clipboard.writeText(`${keyResult.key} ${keyResult.scale}`); showToast("Key copied!", "success"); } catch { showToast("Failed to copy", "error"); } }} className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-[#C9A84C] text-white text-xs transition-all outline-none flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy
                  </button>
                </>
              ) : (
                <p className="text-gray-500 text-xs text-center">Detection failed</p>
              )}
            </div>

            {/* BPM card */}
            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-gray-900 border border-gray-800">
              <p className="text-gray-500 text-xs uppercase tracking-widest">BPM</p>
              {bpmResult ? (
                <>
                  <div className="circle-sweep-wrapper">
                    <div className="w-24 h-24 max-sm:w-20 max-sm:h-20 rounded-full flex flex-col items-center justify-center bg-black">
                      <span className="text-2xl max-sm:text-xl font-bold text-[#C9A84C]">{Math.round(bpmResult.bpm)}</span>
                      <span className="text-xs text-gray-300 mt-0.5">BPM</span>
                    </div>
                  </div>
                  {category && <span className="px-3 py-0.5 rounded-full text-xs font-medium bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/50">{category.label}</span>}
                  <div className="w-full grid grid-cols-2 gap-2">
                    <div className="bg-gray-800 rounded-xl p-2 text-center">
                      <p className="text-gray-500 text-xs mb-0.5">Time Sig.</p>
                      <p className="text-white text-xs font-semibold">{bpmResult.timeSignature}</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-2 text-center">
                      <p className="text-gray-500 text-xs mb-0.5">Beats</p>
                      <p className="text-white text-xs font-semibold">{bpmResult.beatCount}</p>
                    </div>
                  </div>
                  <button onClick={async () => { try { await navigator.clipboard.writeText(`${Math.round(bpmResult.bpm)} BPM`); showToast("BPM copied!", "success"); } catch { showToast("Failed to copy", "error"); } }} className="px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-[#C9A84C] text-white text-xs transition-all outline-none flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy
                  </button>
                </>
              ) : (
                <p className="text-gray-500 text-xs text-center">Detection failed</p>
              )}
            </div>
          </div>

          <p className="text-gray-600 text-xs text-center truncate w-full max-w-sm">{fileName}</p>

          <button onClick={() => { setKeyResult(null); setBpmResult(null); setFileName(""); setLinkUrl(""); setError(""); }} className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-600 hover:border-[#C9A84C] hover:bg-gray-700 text-white text-xs font-medium transition-all duration-200 outline-none">
            Analyze another file
          </button>
        </div>
      )}
    </div>
  );
}
