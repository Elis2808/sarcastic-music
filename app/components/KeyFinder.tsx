"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addHistoryItem } from "../lib/history";
import { addRecentFile } from "../lib/recentFiles";
import UrlDropZone from "./UrlDropZone";
import { showToast } from "./Toast";

interface KeyFinderProps {
  initialUrl?: string;
  initialPlatform?: string;
  initialKey?: string;
  initialScale?: string;
  initialStrength?: number;
  initialRelativeKey?: string;
  initialRelativeScale?: string;
}

const PLATFORMS = [
  { id: "youtube", label: "YouTube", placeholder: "Paste YouTube URL here" },
  { id: "soundcloud", label: "SoundCloud", placeholder: "Paste SoundCloud URL here" },
  { id: "tiktok", label: "TikTok", placeholder: "Paste TikTok URL here" },
  { id: "instagram", label: "Instagram", placeholder: "Paste Instagram URL here" },
  { id: "facebook", label: "Facebook", placeholder: "Paste Facebook URL here" },
  { id: "twitter", label: "Twitter/X", placeholder: "Paste Twitter/X URL here" },
  { id: "reddit", label: "Reddit", placeholder: "Paste Reddit URL here" },
  { id: "bandcamp", label: "Bandcamp", placeholder: "Paste Bandcamp URL here" },
  { id: "mixcloud", label: "Mixcloud", placeholder: "Paste Mixcloud URL here" },
  { id: "dailymotion", label: "Dailymotion", placeholder: "Paste Dailymotion URL here" },
  { id: "imgur", label: "Imgur", placeholder: "Paste Imgur URL here" },
  { id: "vimeo", label: "Vimeo", placeholder: "Paste Vimeo URL here" },
  { id: "twitch", label: "Twitch", placeholder: "Paste Twitch URL here" },
];

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

export default function KeyFinder({ initialUrl, initialPlatform, initialKey, initialScale, initialStrength, initialRelativeKey, initialRelativeScale }: KeyFinderProps) {
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<KeyResult | null>(
    initialKey && initialScale 
      ? { key: initialKey, scale: initialScale, strength: initialStrength || 0.85, relativeKey: initialRelativeKey || "", relativeScale: initialRelativeScale || "" }
      : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [linkUrl, setLinkUrl] = useState(initialUrl || "");
  const [linkMode, setLinkMode] = useState(!!initialUrl);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || "");
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
        /* Circular sweep wrapper */
        .circle-sweep-wrapper {
          position: relative;
          display: inline-block;
          border-radius: 50%;
          padding: 3px;
          background: #111;
          line-height: 0;
        }
        .circle-sweep-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 50%;
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
    setLinkUrl("");
    setLinkMode(false);
    try {
      const res = await detectKey(file);
      setResult(res);
      addHistoryItem({
        type: "key_detect",
        title: file.name,
        details: `Key: ${res.key} ${res.scale}`,
      });
      // Add to recent files
      addRecentFile({
        name: file.name,
        type: file.type || "audio/mpeg",
        size: file.size,
        tool: "key",
      });
    } catch (e) {
      console.error(e);
      setError("Could not detect key. Make sure it's a valid audio file.");
    } finally {
      setLoading(false);
    }
  }, []);

  const processLink = useCallback(async () => {
    if (!linkUrl.trim()) return;
    setLoading(true);
    setResult(null);
    setFileName(linkUrl);
    try {
      // Fetch audio from URL
      const audioRes = await fetch("/api/fetch-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });
      if (!audioRes.ok) {
        const err = await audioRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch audio");
      }

      const audioBlob = await audioRes.blob();
      const audioFile = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });
      
      const res = await detectKey(audioFile);
      setResult(res);
      setFileName(linkUrl);
      
      // Add to history
      addHistoryItem({
        type: "key_detect",
        title: linkUrl.substring(0, 50) + (linkUrl.length > 50 ? '...' : ''),
        details: `Key: ${res.key} ${res.scale}`,
        data: {
          tool: "key",
          url: linkUrl,
          platform: selectedPlatform,
        },
      });
      showToast(`Key detected: ${res.key} ${res.scale}`, "success");
    } catch (err: any) {
      showToast("Invalid link. Update and try again.", "error");
    } finally {
      setLoading(false);
    }
  }, [linkUrl, selectedPlatform]);

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
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">Key Finder</h1>
      <p className="text-gray-500 text-xs mb-4">Instant key &amp; relative key detection.</p>

      {/* Mode toggle */}
      {!result && !loading && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setLinkMode(false)}
            className={`text-sm transition-all duration-200 cursor-pointer ${!linkMode ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}
          >File</button>
          <div
            onClick={() => setLinkMode(!linkMode)}
            className="relative w-12 h-2.5 rounded-full bg-gray-700 cursor-pointer"
          >
            <span className={`absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-[#C9A84C] transition-transform duration-75 pointer-events-none ${linkMode ? "translate-x-9" : "translate-x-0"}`} />
          </div>
          <button
            onClick={() => setLinkMode(true)}
            className={`text-sm transition-all duration-200 cursor-pointer ${linkMode ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}
          >Link</button>
        </div>
      )}

      {/* Platform selector - only in link mode */}
      {!result && !loading && linkMode && (
        <div className="flex items-center gap-2 mb-4 w-full max-w-xl">
          <button
            onClick={() => {
              const container = document.getElementById('key-platform-scroll');
              if (container) container.scrollBy({ left: -150, behavior: 'smooth' });
            }}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-[#C9A84C] transition-all duration-200 flex-shrink-0"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div id="key-platform-scroll" className="flex-1 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 px-1">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id === selectedPlatform ? "" : platform.id)}
                  className={`px-3 py-1.5 rounded-xl bg-black border text-xs transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                    selectedPlatform === platform.id
                      ? "border-[#C9A84C] text-[#C9A84C]"
                      : "border-gray-600 text-white hover:border-[#C9A84C] hover:text-[#C9A84C]"
                  }`}
                >
                  {platform.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              const container = document.getElementById('key-platform-scroll');
              if (container) container.scrollBy({ left: 150, behavior: 'smooth' });
            }}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-[#C9A84C] transition-all duration-200 flex-shrink-0"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Link input */}
      {!result && !loading && linkMode && (
        <div className="w-full max-w-xl mb-4">
          <div className="flex gap-2">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") processLink(); }}
              placeholder={selectedPlatform 
                ? PLATFORMS.find(p => p.id === selectedPlatform)?.placeholder || "Paste link here"
                : "Paste audio URL (YouTube, SoundCloud, etc.)"}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white text-sm outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
            <button
              onClick={processLink}
              disabled={!linkUrl.trim() || loading}
              className="px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 hover:border-[#C9A84C] hover:bg-gray-700 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
            >
              Analyze
            </button>
          </div>
        </div>
      )}

      {/* Drop zone - hide when result shown */}
      {!result && !loading && !linkMode && (
        <UrlDropZone 
          onUrlDrop={(url) => {
            setLinkUrl(url);
            setLinkMode(true);
            // Auto-select platform based on URL
            const platform = PLATFORMS.find(p => url.toLowerCase().includes(p.id));
            if (platform) setSelectedPlatform(platform.id);
            showToast("URL dropped! Click Analyze to detect key.", "info");
          }}
          className="w-full max-w-xl"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`w-full max-sm:h-40 h-52 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              dragging
                ? "border-[#C9A84C] bg-[#C9A84C]/10"
                : "border-[#C9A84C]/40 bg-black hover:border-[#C9A84C]"
            }`}
          >
            <svg className={`w-10 h-10 transition-colors ${dragging ? "text-[#C9A84C]" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-gray-400 text-sm text-center px-4">
              {dragging ? "Drop It!" : "Drop Audio File or URL To Detect The Song Key"}
            </p>
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

      {/* Result */}
      {result && !loading && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <p className="text-gray-500 text-xs uppercase tracking-widest">Detected Key</p>

          {/* Big key display with gold spinning circular border */}
          <div className="circle-sweep-wrapper">
            <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center bg-black">
              <span className="text-5xl font-bold text-[#C9A84C]">{result.key}</span>
              <span className="text-lg text-white mt-1 capitalize">{result.scale}</span>
            </div>
          </div>

          {/* Relative key */}
          <p className="text-gray-400 text-sm">
            Relative key:{" "}
            <span className="font-semibold text-white">
              {result.relativeKey} <span className="capitalize">{result.relativeScale}</span>
            </span>
          </p>

          {/* Confidence bar - gold themed */}
          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Confidence</span>
              <span>{strengthPct}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 bg-[#C9A84C]"
                style={{ width: `${strengthPct}%` }}
              />
            </div>
          </div>

          <p className="text-gray-500 text-xs mt-1">{fileName}</p>

          {/* Action buttons */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${result.key} ${result.scale}`);
                  showToast("Key copied to clipboard!", "success");
                } catch {
                  showToast("Failed to copy", "error");
                }
              }}
              className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-600 hover:border-[#C9A84C] hover:bg-gray-700 text-white text-xs font-medium transition-all duration-200 outline-none flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Key
            </button>
            <button
              onClick={async () => {
                try {
                  const shareUrl = new URL(window.location.href);
                  shareUrl.search = '';
                  shareUrl.searchParams.set('tool', 'key');
                  shareUrl.searchParams.set('key', result.key);
                  shareUrl.searchParams.set('scale', result.scale);
                  shareUrl.searchParams.set('strength', String(result.strength));
                  shareUrl.searchParams.set('relativeKey', result.relativeKey);
                  shareUrl.searchParams.set('relativeScale', result.relativeScale);
                  await navigator.clipboard.writeText(shareUrl.toString());
                  showToast("Share link copied!", "success");
                } catch {
                  showToast("Failed to copy", "error");
                }
              }}
              className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-600 hover:border-[#C9A84C] hover:bg-gray-700 text-white text-xs font-medium transition-all duration-200 outline-none flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>

          <button
            onClick={() => { setResult(null); setFileName(""); setLinkUrl(""); }}
            className="mt-2 px-4 py-2 rounded-xl bg-gray-800 border border-gray-600 hover:border-[#C9A84C] hover:bg-gray-700 text-white text-xs font-medium transition-all duration-200 outline-none"
          >
            Analyze another file
          </button>
        </div>
      )}
    </div>
  );
}
