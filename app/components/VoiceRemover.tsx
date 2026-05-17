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

function DownloadReadyCard({ instrumentalUrl, vocalsUrl, filename, onDismiss }: {
  instrumentalUrl?: string;
  vocalsUrl?: string;
  filename?: string;
  onDismiss: () => void;
}) {
  const [downloading, setDownloading] = useState<"instrumental" | "vocals" | null>(null);

  const handleDownload = async (url: string, stem: "instrumental" | "vocals") => {
    setDownloading(stem);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `${filename || "song"}_${stem}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 10000);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="mt-6 w-full max-w-xs rounded-xl border border-gray-800 bg-black px-5 py-4 flex flex-col items-center gap-3">
      <p className="text-white text-sm font-semibold text-center">Download ready</p>
      <p className="text-gray-500 text-xs text-center -mt-1">Tap if auto-download didn&apos;t start</p>
      <div className="flex gap-3 w-full">
        {instrumentalUrl && (
          <div className={`flex-1 ${downloading === "instrumental" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-800"}`}>
            <button
              onClick={() => handleDownload(instrumentalUrl, "instrumental")}
              disabled={downloading !== null}
              className="w-full px-3 py-2 rounded-[10px] bg-black text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading === "instrumental" ? "Downloading..." : "Instrumental"}
            </button>
          </div>
        )}
        {vocalsUrl && (
          <div className={`flex-1 ${downloading === "vocals" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-800"}`}>
            <button
              onClick={() => handleDownload(vocalsUrl, "vocals")}
              disabled={downloading !== null}
              className="w-full px-3 py-2 rounded-[10px] bg-black text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading === "vocals" ? "Downloading..." : "Vocals"}
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function VoiceRemover({ initialUrl, initialPlatform }: VoiceRemoverProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState(initialUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || "");
  const [processing, setProcessing] = useState<StemType | null>(null);
  // bothPhase drives the sequential animation for "both" mode
  const [bothPhase, setBothPhase] = useState<"processing" | "instrumental" | "transit" | "vocals" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [demucsProgress, setDemucsProgress] = useState(0);
  const [stemProgress, setStemProgress] = useState(0); // per-stem fetch progress
  const [error, setError] = useState("");
  const [pendingDownloads, setPendingDownloads] = useState<{instrumentalUrl?: string, vocalsUrl?: string, filename?: string} | null>(null);
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
        .btn-sweep-sm {
          position: relative;
          border-radius: 8px;
          padding: 3px;
          background: #000;
          will-change: transform;
        }
        .btn-sweep-sm::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 8px;
          background: conic-gradient(from var(--sweep-angle), transparent 0deg, transparent 270deg, #C9A84C 310deg, #e8c96a 340deg, #C9A84C 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: btn-sweep 1.4s linear infinite;
        }
        @keyframes progress-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .progress-fill {
          background: linear-gradient(90deg, #C9A84C 0%, #e8c96a 40%, #C9A84C 60%, #b8943e 100%);
          background-size: 200% 100%;
          animation: progress-shimmer 2.2s ease-in-out infinite;
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
    if (stem === "both") setBothPhase("processing");
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
      const baseName = (file?.name || "song").replace(/\.[^.]+$/, "");

      // Helper: fetch a URL and trigger download, tracking progress
      const fetchAndDownload = async (url: string, filename: string, onProgress: (p: number) => void) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Download failed");
        const total = Number(res.headers.get("content-length") || 0);
        const reader = res.body!.getReader();
        const chunks: ArrayBuffer[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value.buffer as ArrayBuffer);
          received += value.length;
          if (total > 0) onProgress(Math.round((received / total) * 100));
        }
        onProgress(100);
        const blob = new Blob(chunks, { type: "audio/mpeg" });
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(dlUrl), 10000);
      };

      if (stem === "both" && result.vocalsUrl) {
        // Phase 1: instrumental
        setBothPhase("instrumental");
        setStemProgress(0);
        await fetchAndDownload(result.downloadUrl, `${baseName}_instrumental.mp3`, p => setStemProgress(p));

        // Phase 2: transit shine through Both button
        setBothPhase("transit");
        setStemProgress(0);
        await new Promise(r => setTimeout(r, 900));

        // Phase 3: vocals
        setBothPhase("vocals");
        setStemProgress(0);
        await fetchAndDownload(result.vocalsUrl, `${baseName}_vocals.mp3`, p => setStemProgress(p));

        // Store for manual fallback
        setPendingDownloads({ instrumentalUrl: result.downloadUrl, vocalsUrl: result.vocalsUrl, filename: baseName });
        setBothPhase(null);
      } else {
        // Single stem
        setStemProgress(0);
        await fetchAndDownload(result.downloadUrl, `${baseName}_${stem === "vocals" ? "vocals" : "instrumental"}.mp3`, p => setStemProgress(p));
        setPendingDownloads({
          instrumentalUrl: stem === "no_vocals" ? result.downloadUrl : undefined,
          vocalsUrl: stem === "vocals" ? result.downloadUrl : undefined,
          filename: baseName
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProcessing(null);
      setBothPhase(null);
      setStemProgress(0);
      setElapsed(0);
      setDemucsProgress(0);
    }
  }, [file, linkUrl]);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 select-none max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">
        {selectedPlatform ? `${PLATFORMS.find(p => p.id === selectedPlatform)?.label || ''} Song Splitter` : "Song Splitter"}
      </h1>
      <p className="text-gray-500 text-xs mb-4">Split any song into a vocal file and instrumental file.</p>

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
            className="w-full px-4 py-3 rounded-full bg-black border border-[rgba(255,255,255,0.07)] text-white outline-none focus:ring-2 focus:ring-[#C9A84C] placeholder-gray-500"
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
            className={`w-full max-sm:h-40 h-52 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
              file
                ? "border-[#C9A84C] bg-black cursor-default"
                : dragging
                ? "border-[#C9A84C] bg-[#C9A84C]/10 scale-[1.02] cursor-copy"
                : "border-[#C9A84C]/40 bg-black hover:border-[#C9A84C] cursor-pointer"
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
            <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.aiff,.aif,.wma,.opus,.mp4" className="hidden" onChange={onFileChange} />
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
          <div className="relative flex items-center gap-3 w-full">
            {/* Instrumental */}
            <div className={`flex-1 ${
              processing === "no_vocals" || bothPhase === "instrumental"
                ? "btn-sweep-wrapper"
                : "rounded-xl p-[3px] bg-gray-700"
            }`}>
              <button
                onClick={() => download("no_vocals")}
                disabled={processing !== null}
                className="w-full px-4 py-3 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 outline-none"
              >
                <svg className="w-4 h-4 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-xs">Instrumental</span>
              </button>
            </div>

            {/* Both button */}
            <div className={
              bothPhase === "processing"
                ? "btn-sweep-wrapper"
                : "rounded-xl p-[3px] bg-gray-700"
            }>
              <button
                onClick={() => download("both")}
                disabled={processing !== null}
                className="px-3 py-2 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none whitespace-nowrap"
              >
                Both
              </button>
            </div>

            {/* Vocals */}
            <div className={`flex-1 ${
              processing === "vocals" || bothPhase === "vocals"
                ? "btn-sweep-wrapper"
                : "rounded-xl p-[3px] bg-gray-700"
            }`}>
              <button
                onClick={() => download("vocals")}
                disabled={processing !== null}
                className="w-full px-4 py-3 rounded-[10px] bg-black hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 outline-none"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xs">Vocals</span>
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {processing && (
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                {bothPhase === "instrumental" ? (
                  <><span>Instrumental Progress</span><span>{stemProgress}%</span></>
                ) : bothPhase === "vocals" ? (
                  <><span>Vocal Progress</span><span>{stemProgress}%</span></>
                ) : bothPhase === "transit" ? (
                  <><span>Preparing vocals...</span><span></span></>
                ) : (
                  <><span>Processing</span><span>{Math.round(demucsProgress)}%</span></>
                )}
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full progress-fill"
                  style={{
                    width: `${
                      bothPhase === "instrumental" || bothPhase === "vocals"
                        ? stemProgress
                        : bothPhase === "transit"
                        ? 100
                        : Math.round(demucsProgress)
                    }%`,
                    transition: "width 1200ms cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download Ready - Manual fallback */}
      {pendingDownloads && (
        <DownloadReadyCard
          instrumentalUrl={pendingDownloads.instrumentalUrl}
          vocalsUrl={pendingDownloads.vocalsUrl}
          filename={pendingDownloads.filename}
          onDismiss={() => setPendingDownloads(null)}
        />
      )}
    </div>
  );
}
