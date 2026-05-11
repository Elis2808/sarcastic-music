"use client";

import { useState, useEffect } from "react";

const PLATFORMS = [
  { name: "YouTube",    placeholder: "Paste YouTube URL here" },
  { name: "TikTok",     placeholder: "Paste TikTok URL here" },
  { name: "Instagram",  placeholder: "Paste Instagram URL here" },
  { name: "Facebook",   placeholder: "Paste Facebook URL here" },
  { name: "Twitter",    placeholder: "Paste Twitter/X URL here" },
  { name: "SoundCloud", placeholder: "Paste SoundCloud URL here" },
  { name: "Vimeo",      placeholder: "Paste Vimeo URL here" },
  { name: "Twitch",     placeholder: "Paste Twitch URL here" },
];

function formatDuration(seconds: string) {
  const s = parseInt(seconds);
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function Downloader() {
  const [selectedPlatform, setSelectedPlatform] = useState("YouTube");
  const [ytUrl, setYtUrl] = useState("");
  const [ytInfo, setYtInfo] = useState<{ title: string; author: string; lengthSeconds: string; thumbnail: string } | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState("");
  const [ytDownloading, setYtDownloading] = useState<"mp3" | "mp4" | null>(null);

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

  async function fetchInfo() {
    if (!ytUrl.trim()) return;
    setYtLoading(true);
    setYtError("");
    setYtInfo(null);
    try {
      const res = await fetch(`/api/youtube?url=${encodeURIComponent(ytUrl)}`);
      const data = await res.json();
      if (!res.ok) setYtError(data.error || "Something went wrong.");
      else setYtInfo(data);
    } catch {
      setYtError("Network error. Please try again.");
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
        setYtError(data.error || "Download failed.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${ytInfo?.title || "download"}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setYtError("Download failed. Please try again.");
    } finally {
      setYtDownloading(null);
    }
  }

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">{selectedPlatform} Downloader</h1>

      <div className="grid grid-cols-4 max-sm:grid-cols-2 gap-2 mb-4 w-full max-w-xl">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.name}
            onClick={() => setSelectedPlatform(platform.name)}
            className={`px-3 py-1.5 rounded-xl bg-black border text-xs transition-all duration-200 ${
              selectedPlatform === platform.name
                ? "border-[#C9A84C] text-[#C9A84C]"
                : "border-gray-600 text-white hover:border-[#C9A84C] hover:text-[#C9A84C]"
            }`}
          >
            {platform.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 w-full max-w-xl max-sm:flex-col">
        <input
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fetchInfo(); }}
          placeholder={PLATFORMS.find(p => p.name === selectedPlatform)?.placeholder}
          className="flex-1 px-4 py-3 rounded-xl bg-black border border-gray-600 text-white outline-none focus:ring-2 focus:ring-[#C9A84C]"
        />
        <div className={`max-sm:w-full ${ytLoading ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-[#C9A84C]"}`}>
          <button
            onClick={fetchInfo}
            disabled={ytLoading}
            className="px-6 py-3 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 outline-none flex items-center justify-center gap-2 w-full"
          >
            {ytLoading ? <span className="text-[#C9A84C]">Converting...</span> : "Convert"}
          </button>
        </div>
      </div>

      {ytError && <p className="mt-4 text-red-400 text-sm">{ytError}</p>}

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
              <div className={ytDownloading === "mp3" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-[#C9A84C]"}>
                <button
                  onClick={() => handleDownload("mp3")}
                  disabled={ytDownloading !== null}
                  className="px-4 py-2 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
                >
                  {ytDownloading === "mp3" ? <span className="text-[#C9A84C]">Processing...</span> : "Download MP3"}
                </button>
              </div>
              <div className={ytDownloading === "mp4" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-[#C9A84C]"}>
                <button
                  onClick={() => handleDownload("mp4")}
                  disabled={ytDownloading !== null}
                  className="px-4 py-2 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none"
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
