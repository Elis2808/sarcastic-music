"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addHistoryItem } from "../lib/history";
import { addRecentFile } from "../lib/recentFiles";
import UrlDropZone from "./UrlDropZone";
import { showToast } from "./Toast";

type StemType = "no_vocals" | "vocals" | "both";

interface VoiceRemoverProps {
  initialUrl?: string;
  initialPlatform?: string;
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

export default function VoiceRemover({ initialUrl, initialPlatform }: VoiceRemoverProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState(initialUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || "");
  const [processing, setProcessing] = useState<StemType | null>(null);
  const [downloadingStem, setDownloadingStem] = useState<"no_vocals" | "vocals" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [demucsProgress, setDemucsProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError("");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { handleFile(f); e.target.value = ""; }
  }, [handleFile]);

  const download = useCallback(async (stem: StemType) => {
    if (!file && !linkUrl.trim()) return;
    setProcessing(stem);
    setElapsed(0);
    setDemucsProgress(0);
    setError("");

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    try {
      let jobId: string;
      
      if (linkUrl.trim()) {
        // Process link through downloader first
        const linkRes = await fetch("/api/youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: linkUrl.trim(), format: "mp3" }),
        });
        if (!linkRes.ok) {
          const err = await linkRes.json();
          throw new Error(err.error || "Failed to fetch audio from link");
        }
        const audioBlob = await linkRes.blob();
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.mp3");
        formData.append("stem", stem);
        
        const startRes = await fetch("/api/separate", { method: "POST", body: formData });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || "Failed to start processing");
        jobId = startData.jobId;

        // Add to history for link processing
        const displayName = linkUrl.substring(0, 50) + (linkUrl.length > 50 ? '...' : '');
        addHistoryItem({
          type: "song_split",
          title: displayName,
          details: stem === "both" ? "Vocals + Instrumental" : stem === "vocals" ? "Vocals only" : "Instrumental only",
          data: {
            tool: "voice",
            url: linkUrl,
            platform: selectedPlatform || undefined,
          },
        });
      } else {
        // Process file upload
        const formData = new FormData();
        formData.append("file", file!);
        formData.append("stem", stem);
        
        const startRes = await fetch("/api/separate", { method: "POST", body: formData });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || "Failed to start processing");
        jobId = startData.jobId;

        // Add to history
        const displayName = file?.name || linkUrl.substring(0, 50) + (linkUrl.length > 50 ? '...' : '');
        addHistoryItem({
          type: "song_split",
          title: displayName,
          details: stem === "both" ? "Vocals + Instrumental" : stem === "vocals" ? "Vocals only" : "Instrumental only",
          data: {
            tool: "voice",
            url: linkUrl || undefined,
            platform: selectedPlatform || undefined,
            fileName: file?.name,
          },
        });
      }

      // Poll for job completion
      const pollJob = async (jid: string): Promise<{downloadUrl: string, vocalsUrl?: string}> => {
        const deadline = Date.now() + 8 * 60 * 1000;
        while (true) {
          if (Date.now() > deadline) throw new Error("Processing timed out.");
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await fetch(`/api/separate?id=${jid}`);
          const pollData = await pollRes.json().catch(() => ({}));
          if (pollRes.status === 404) throw new Error("Job lost due to server restart. Please try again.");
          if (!pollRes.ok) throw new Error(pollData.error || "Processing failed");
          if (pollData.status === "error") throw new Error(pollData.error || "Processing failed");
          if (typeof pollData.progress === "number") setDemucsProgress(pollData.progress);
          if (pollData.downloadUrl) return pollData;
        }
      };

      const result = await pollJob(jobId);
      
      if (stem === "both" && result.vocalsUrl) {
        // Download both stems sequentially with visual feedback
        // First: Instrumental
        setDownloadingStem("no_vocals");
        const a1 = document.createElement("a");
        a1.href = result.downloadUrl;
        a1.download = `${(file?.name || "song").replace(/\.[^.]+$/, "")}_instrumental.mp3`;
        a1.click();
        
        await new Promise(r => setTimeout(r, 1500));
        
        // Then: Vocals
        setDownloadingStem("vocals");
        const a2 = document.createElement("a");
        a2.href = result.vocalsUrl;
        a2.download = `${(file?.name || "song").replace(/\.[^.]+$/, "")}_vocals.mp3`;
        a2.click();
        
        await new Promise(r => setTimeout(r, 500));
        setDownloadingStem(null);
      } else {
        // Single stem
        const a1 = document.createElement("a");
        a1.href = result.downloadUrl;
        a1.download = `${(file?.name || "song").replace(/\.[^.]+$/, "")}_${stem === "vocals" ? "vocals" : "instrumental"}.mp3`;
        a1.click();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProcessing(null);
      setDownloadingStem(null);
      setElapsed(0);
      setDemucsProgress(0);
    }
  }, [file, linkUrl]);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 select-none max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">
        {selectedPlatform ? `${PLATFORMS.find(p => p.id === selectedPlatform)?.label || ''} Song Splitter` : "Song Splitter"}
      </h1>

      {/* Platform selector with scroll arrows */}
      <div className="flex items-center gap-2 mb-4 w-full max-w-xl">
        <button
          onClick={() => {
            const container = document.getElementById('platform-scroll');
            if (container) container.scrollBy({ left: -150, behavior: 'smooth' });
          }}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-[#C9A84C] transition-all duration-200 flex-shrink-0"
          aria-label="Scroll left"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div id="platform-scroll" className="flex-1 overflow-x-auto scrollbar-hide">
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
            const container = document.getElementById('platform-scroll');
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

      {/* Link input */}
      <div className="w-full max-w-xl mb-4">
        <div className="relative">
          <input
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); setFile(null); }}
            placeholder={selectedPlatform 
              ? PLATFORMS.find(p => p.id === selectedPlatform)?.placeholder || "Paste link here"
              : "Paste audio link here (YouTube, SoundCloud, TikTok, etc.)"}
            className="w-full px-4 py-3 rounded-xl bg-black border border-gray-600 text-white outline-none focus:ring-2 focus:ring-[#C9A84C]"
          />
          {linkUrl && (
            <button
              onClick={() => setLinkUrl("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Drop zone - only show when no link entered */}
      {!linkUrl && (
        <UrlDropZone
          onUrlDrop={(url) => {
            setLinkUrl(url);
            const platform = PLATFORMS.find(p => url.toLowerCase().includes(p.id));
            if (platform) setSelectedPlatform(platform.id);
            showToast("URL dropped! Click Process to start separation.", "info");
          }}
          className="w-full max-w-xl"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            className={`w-full max-sm:h-40 h-52 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
              file
                ? "border-[#C9A84C] bg-[#C9A84C]/5 cursor-default"
                : dragging
                ? "border-[#C9A84C] bg-[#C9A84C]/10 scale-[1.02] cursor-copy"
                : "border-gray-600 bg-gray-900 hover:border-[#C9A84C] hover:bg-black cursor-pointer"
            }`}
          >
            {file ? (
              <>
                <svg className="w-10 h-10 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-white font-medium text-sm">{file.name}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); setError(""); }}
                  className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                >
                  Remove file
                </button>
              </>
            ) : (
              <>
                <svg className={`w-10 h-10 transition-colors ${dragging ? "text-[#C9A84C]" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <p className="text-gray-400 text-sm text-center px-4">{dragging ? "Drop It!" : "Drop audio file or URL here"}</p>
              </>
            )}
            <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
          </div>
        </UrlDropZone>
      )}

      {/* Error */}
      {error && <p className="mt-4 text-red-400 text-sm text-center max-w-md">{error}</p>}

      {/* Download buttons */}
      {(file || linkUrl.trim()) && (
        <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-xs">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Download as</p>

          {/* Main buttons with Both in middle */}
          <div className="flex items-center gap-3 w-full">
            {/* Instrumental */}
            <div className={`flex-1 ${downloadingStem === "no_vocals" || (processing === "both" && !downloadingStem) || processing === "no_vocals" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-700"}`}>
              <button
                onClick={() => download("no_vocals")}
                disabled={processing !== null}
                className="w-full px-4 py-3 rounded-[10px] bg-black border border-[#C9A84C] hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 outline-none"
              >
                <svg className="w-4 h-4 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-xs">Instrumental</span>
              </button>
            </div>

            {/* Both button with connecting lines */}
            <div className="relative flex flex-col items-center">
              {/* Connecting lines */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-gradient-to-r from-gray-600 to-[#C9A84C]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-gradient-to-l from-gray-600 to-[#C9A84C]" />
              
              <div className={`${processing === null ? "" : "rounded-lg p-[2px] bg-gray-600"}`}>
                <button
                  onClick={() => download("both")}
                  disabled={processing !== null}
                  className="px-3 py-2 rounded-[6px] bg-black border border-gray-500 hover:border-[#C9A84C] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none whitespace-nowrap"
                >
                  Both
                </button>
              </div>
            </div>

            {/* Vocals */}
            <div className={`flex-1 ${downloadingStem === "vocals" || (processing === "both" && !downloadingStem) || processing === "vocals" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-700"}`}>
              <button
                onClick={() => download("vocals")}
                disabled={processing !== null}
                className="w-full px-4 py-3 rounded-[10px] bg-black border border-gray-500 hover:border-[#C9A84C] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 outline-none"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xs">Vocals</span>
              </button>
            </div>
          </div>

          {/* Progress bar - shows when processing */}
          {processing && (
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Processing</span>
                <span>{Math.round(demucsProgress)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[#C9A84C]"
                  style={{ width: `${demucsProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
