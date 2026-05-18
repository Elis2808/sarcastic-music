"use client";

import { useState, useEffect, useRef } from "react";
import { addHistoryItem } from "../lib/history";
import UrlDropZone from "./UrlDropZone";
import { showToast } from "./Toast";

interface DownloaderProps {
  initialUrl?: string;
  initialPlatform?: string;
}

const PLATFORMS = [
  { name: "YouTube",     placeholder: "Paste YouTube URL here" },
  { name: "TikTok",      placeholder: "Paste TikTok URL here" },
  { name: "Instagram",   placeholder: "Paste Instagram URL here" },
  { name: "Facebook",    placeholder: "Paste Facebook URL here" },
  { name: "Twitter",     placeholder: "Paste Twitter/X URL here" },
  { name: "Reddit",      placeholder: "Paste Reddit URL here" },
  { name: "SoundCloud",  placeholder: "Paste SoundCloud URL here" },
  { name: "Bandcamp",    placeholder: "Paste Bandcamp URL here" },
  { name: "Mixcloud",    placeholder: "Paste Mixcloud URL here" },
  { name: "Dailymotion", placeholder: "Paste Dailymotion URL here" },
  { name: "Imgur",       placeholder: "Paste Imgur URL here" },
  { name: "Vimeo",       placeholder: "Paste Vimeo URL here" },
  { name: "Twitch",      placeholder: "Paste Twitch URL here" },
];

function formatDuration(seconds: string) {
  const s = parseInt(seconds);
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function Downloader({ initialUrl, initialPlatform }: DownloaderProps) {
  const platformScrollRef = useRef<HTMLDivElement>(null);
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || "YouTube");
  const [ytUrl, setYtUrl] = useState(initialUrl || "");
  const [ytInfo, setYtInfo] = useState<{ title: string; author: string; lengthSeconds: string; thumbnail: string } | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytDownloading, setYtDownloading] = useState<"mp3" | "mp4" | null>(null);
  const [analyzing, setAnalyzing] = useState<"bpm" | "key" | "split" | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{type: "bpm" | "key"; data: any} | null>(null);
  const [rightsAccepted, setRightsAccepted] = useState(false);

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
          will-change: transform;
          contain: layout style;
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
          will-change: transform;
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
          will-change: transform;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  async function fetchInfo() {
    if (!ytUrl.trim()) return;
    if (!rightsAccepted) {
      showToast("Please confirm you own or have rights to this content.", "error");
      return;
    }
    // Log acceptance — fire and forget
    fetch("/api/log-acceptance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "downloader" }),
    }).catch(() => {});
    setYtLoading(true);
    setYtInfo(null);
    try {
      const res = await fetch(`/api/youtube?url=${encodeURIComponent(ytUrl)}`);
      const data = await res.json();
      if (!res.ok) {
        showToast("Invalid link. Update and try again.", "error");
      } else {
        setYtInfo(data);
      }
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setYtLoading(false);
    }
  }

  async function handleDownload(format: "mp3" | "mp4") {
    setYtDownloading(format);
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl, format }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Download failed.", "error");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${ytInfo?.title || "download"}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      
      // Add to history
      addHistoryItem({
        type: "download",
        title: ytInfo?.title || "download",
        details: `${format.toUpperCase()} from ${selectedPlatform}`,
        data: {
          tool: "youtube",
          url: ytUrl,
          platform: selectedPlatform,
          fileName: ytInfo?.title,
        },
      });
      showToast(`Downloaded ${format.toUpperCase()} successfully!`, "success");
    } catch (e: any) {
      showToast(e.message || "Download failed", "error");
    } finally {
      setYtDownloading(null);
    }
  }

  async function analyzeBpm() {
    if (!ytUrl.trim()) return;
    setAnalyzing("bpm");
    setAnalysisResult(null);
    try {
      // Download audio first
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl, format: "mp3" }),
      });
      if (!res.ok) throw new Error("Failed to fetch audio");
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, "audio.mp3");
      const bpmRes = await fetch("/api/detect-bpm", { method: "POST", body: formData });
      const data = await bpmRes.json();
      if (!bpmRes.ok) throw new Error(data.error || "BPM detection failed");
      setAnalysisResult({ type: "bpm", data });
    } catch (e: any) {
      showToast(e.message || "BPM detection failed", "error");
    } finally {
      setAnalyzing(null);
    }
  }

  async function analyzeKey() {
    if (!ytUrl.trim()) return;
    setAnalyzing("key");
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl, format: "mp3" }),
      });
      if (!res.ok) throw new Error("Failed to fetch audio");
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, "audio.mp3");
      const keyRes = await fetch("/api/detect-key", { method: "POST", body: formData });
      const data = await keyRes.json();
      if (!keyRes.ok) throw new Error(data.error || "Key detection failed");
      setAnalysisResult({ type: "key", data });
    } catch (e: any) {
      showToast(e.message || "Key detection failed", "error");
    } finally {
      setAnalyzing(null);
    }
  }

  async function splitSong() {
    if (!ytUrl.trim()) return;
    setAnalyzing("split");
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl, format: "mp3" }),
      });
      if (!res.ok) throw new Error("Failed to fetch audio");
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, "audio.mp3");
      formData.append("stem", "no_vocals");
      const startRes = await fetch("/api/separate", { method: "POST", body: formData });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error || "Failed to start splitting");
      const jobId = startData.jobId;
      // Poll for result
      const deadline = Date.now() + 8 * 60 * 1000;
      while (true) {
        if (Date.now() > deadline) throw new Error("Processing timed out");
        await new Promise(r => setTimeout(r, 4000));
        const pollRes = await fetch(`/api/separate?id=${jobId}`);
        const pollData = await pollRes.json().catch(() => ({}));
        if (pollRes.status === 404) continue;
        if (!pollRes.ok) throw new Error(pollData.error || "Processing failed");
        if (pollData.status === "error") throw new Error(pollData.error || "Processing failed");
        if (pollData.downloadUrl) {
          const a = document.createElement("a");
          a.href = pollData.downloadUrl;
          a.download = `${ytInfo?.title || "song"}_instrumental.mp3`;
          a.click();
          showToast("Split complete! Downloading...", "success");
          break;
        }
      }
    } catch (e: any) {
      showToast(e.message || "Song splitting failed", "error");
    } finally {
      setAnalyzing(null);
    }
  }

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">{selectedPlatform} Downloader</h1>
      <p className="text-gray-500 text-xs mb-4">Convert any social media link to MP3 &amp; MP4.</p>

      {/* Platform selector */}
      <div className="w-full max-w-xl mb-4 flex items-center gap-2">
        {/* Left arrow - desktop only */}
        <button
          onClick={() => {
            const el = platformScrollRef.current;
            if (el) el.scrollBy({ left: -120, behavior: "smooth" });
          }}
          style={{ border: "1px solid rgba(201,168,76,0.5)", background: "black" }}
          className="hidden sm:flex flex-shrink-0 w-7 h-7 items-center justify-center rounded-full text-white text-sm outline-none transition-colors hover:border-[#C9A84C]"
        >‹</button>

        {/* Scrollable pills */}
        <div
          ref={platformScrollRef}
          className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-hide"
          style={{
            backgroundColor: "rgba(20,20,24,0.48)",
            backdropFilter: "blur(14px) saturate(160%)",
            WebkitBackdropFilter: "blur(14px) saturate(160%)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 9999,
            padding: "4px 6px",
          }}
        >
          {PLATFORMS.map((platform) => {
            const isActive = selectedPlatform === platform.name;
            return (
              <button
                key={platform.name}
                onClick={() => setSelectedPlatform(platform.name)}
                style={{
                  color: isActive ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)",
                  border: isActive ? "1px solid rgba(201,168,76,0.6)" : "1px solid transparent",
                  backgroundColor: "transparent",
                  transition: "color 160ms ease-out, border-color 160ms ease-out",
                }}
                className="px-4 py-1.5 rounded-full text-xs font-medium outline-none whitespace-nowrap flex-shrink-0"
              >
                {platform.name}
              </button>
            );
          })}
        </div>

        {/* Right arrow - desktop only */}
        <button
          onClick={() => {
            const el = platformScrollRef.current;
            if (el) el.scrollBy({ left: 120, behavior: "smooth" });
          }}
          style={{ border: "1px solid rgba(201,168,76,0.5)", background: "black" }}
          className="hidden sm:flex flex-shrink-0 w-7 h-7 items-center justify-center rounded-full text-white text-sm outline-none transition-colors hover:border-[#C9A84C]"
        >›</button>
      </div>


      <UrlDropZone
        onUrlDrop={(url) => {
          setYtUrl(url);
          const platform = PLATFORMS.find(p => url.toLowerCase().includes(p.name.toLowerCase()));
          if (platform) setSelectedPlatform(platform.name);
          showToast("URL dropped! Click Convert to download.", "info");
        }}
        className="w-full max-w-xl"
      >
        <div className="flex flex-col items-center gap-3 w-full">
          <input
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") fetchInfo(); }}
            placeholder={PLATFORMS.find(p => p.name === selectedPlatform)?.placeholder}
            className="w-full px-4 py-3 rounded-full bg-black text-white outline-none focus:ring-2 focus:ring-[#C9A84C] placeholder-gray-500"
            style={{ border: "1px solid rgba(201,168,76,0.25)" }}
          />
          {/* Rights confirmation checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer max-w-xl w-full px-1">
            <div className="relative flex-shrink-0 mt-0.5 w-4 h-4">
              <input
                type="checkbox"
                checked={rightsAccepted}
                onChange={(e) => setRightsAccepted(e.target.checked)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                style={{ borderColor: "#C9A84C", background: "black" }}
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center pointer-events-none transition-all duration-150"
              >
                {rightsAccepted && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-400 leading-relaxed">
              I confirm I own or have the legal right to download this content. I understand this tool is for personal use only. See our{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#C9A84C] hover:underline">Terms of Service</a>.
            </span>
          </label>

          <div className={`w-36 ${ytLoading ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]"}`}>
            <button
              onClick={fetchInfo}
              disabled={ytLoading || !ytUrl.trim() || !rightsAccepted}
              className="w-full px-6 py-2.5 rounded-full bg-black text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 text-sm font-medium transition-all duration-200 outline-none flex items-center justify-center gap-2"
            >
              {ytLoading ? <span className="text-[#C9A84C]">Converting...</span> : "Convert"}
            </button>
          </div>
        </div>
      </UrlDropZone>

      {/* Analyze buttons - always show when URL entered */}
      {ytUrl.trim() && (
        <div className="mt-4 flex gap-2 flex-wrap justify-center w-full max-w-xl">
          <div className={analyzing === "bpm" ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]" }>
            <button
              onClick={analyzeBpm}
              disabled={analyzing !== null || ytDownloading !== null}
              className="px-4 py-2 rounded-full bg-black active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
            >
              {analyzing === "bpm" ? <span className="text-[#C9A84C]">Finding BPM...</span> : "Find BPM"}
            </button>
          </div>
          <div className={analyzing === "key" ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]"}>
            <button
              onClick={analyzeKey}
              disabled={analyzing !== null || ytDownloading !== null}
              className="px-4 py-2 rounded-full bg-black active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
            >
              {analyzing === "key" ? <span className="text-[#C9A84C]">Finding Key...</span> : "Find Key"}
            </button>
          </div>
          <div className={analyzing === "split" ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]"}>
            <button
              onClick={splitSong}
              disabled={analyzing !== null || ytDownloading !== null}
              className="px-4 py-2 rounded-full bg-black active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
            >
              {analyzing === "split" ? <span className="text-[#C9A84C]">Splitting...</span> : "Split Song"}
            </button>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <div className="mt-4 w-full max-w-xl">
          {analysisResult.type === "bpm" && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-gray-500 text-xs uppercase tracking-widest">Detected BPM</p>
              <div className="circle-sweep-wrapper">
                <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center bg-black">
                  <span className="text-3xl font-bold text-[#C9A84C]">{Math.round(analysisResult.data.bpm)}</span>
                  <span className="text-xs text-gray-300">BPM</span>
                </div>
              </div>
              <p className="text-gray-400 text-xs">{analysisResult.data.timeSignature} · {analysisResult.data.beatCount} beats</p>
            </div>
          )}
          {analysisResult.type === "key" && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-gray-500 text-xs uppercase tracking-widest">Detected Key</p>
              <div className="circle-sweep-wrapper">
                <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center bg-black">
                  <span className="text-3xl font-bold text-[#C9A84C]">{analysisResult.data.key}</span>
                  <span className="text-xs text-gray-300 capitalize">{analysisResult.data.scale}</span>
                </div>
              </div>
              <p className="text-gray-400 text-xs">Relative: {analysisResult.data.relativeKey} {analysisResult.data.relativeScale}</p>
            </div>
          )}
        </div>
      )}

      {ytInfo && (
        <div className="mt-6 w-full max-w-xl bg-gray-900 rounded-lg p-4 flex gap-4 items-start max-sm:flex-col max-sm:items-center">
          {ytInfo.thumbnail && (
            <img
              src={`/api/proxy-image?url=${encodeURIComponent(ytInfo.thumbnail)}`}
              alt="thumbnail"
              className="w-32 h-20 object-cover rounded max-sm:w-full max-sm:h-40"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{ytInfo.title}</p>
            <p className="text-gray-400 text-xs mt-1">{ytInfo.author} · {formatDuration(ytInfo.lengthSeconds)}</p>
            <div className="flex gap-2 mt-3">
              <div className={ytDownloading === "mp3" ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]" }>
                <button
                  onClick={() => handleDownload("mp3")}
                  disabled={ytDownloading !== null || analyzing !== null}
                  className="px-4 py-2 rounded-full bg-black active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
                >
                  {ytDownloading === "mp3" ? <span className="text-[#C9A84C]">Processing...</span> : "Download MP3"}
                </button>
              </div>
              <div className={ytDownloading === "mp4" ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]"}>
                <button
                  onClick={() => handleDownload("mp4")}
                  disabled={ytDownloading !== null || analyzing !== null}
                  className="px-4 py-2 rounded-full bg-black active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
                >
                  {ytDownloading === "mp4" ? <span className="text-[#C9A84C]">Processing...</span> : "Download MP4"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
