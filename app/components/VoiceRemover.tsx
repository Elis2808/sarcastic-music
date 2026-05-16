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
  const [pendingDownloads, setPendingDownloads] = useState<{instrumentalUrl?: string, vocalsUrl?: string, filename?: string} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll effect for stem buttons
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    
    let scrollAmount = 0;
    const scrollStep = 0.5; // pixels per frame
    let direction = 1;
    let rafId: number;
    
    const autoScroll = () => {
      if (!container) return;
      
      const maxScroll = container.scrollWidth - container.clientWidth;
      
      if (maxScroll <= 0) {
        rafId = requestAnimationFrame(autoScroll);
        return;
      }
      
      scrollAmount += scrollStep * direction;
      
      // Reverse direction at ends
      if (scrollAmount >= maxScroll) {
        direction = -1;
        scrollAmount = maxScroll;
      } else if (scrollAmount <= 0) {
        direction = 1;
        scrollAmount = 0;
      }
      
      container.scrollLeft = scrollAmount;
      rafId = requestAnimationFrame(autoScroll);
    };
    
    // Pause on hover
    const handleMouseEnter = () => cancelAnimationFrame(rafId);
    const handleMouseLeave = () => { rafId = requestAnimationFrame(autoScroll); };
    
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('touchstart', handleMouseEnter, { passive: true });
    container.addEventListener('touchend', handleMouseLeave, { passive: true });
    
    rafId = requestAnimationFrame(autoScroll);
    
    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('touchstart', handleMouseEnter);
      container.removeEventListener('touchend', handleMouseLeave);
    };
  }, []);

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
        // Store for manual download fallback (mobile Safari blocks auto-downloads)
        const baseName = (file?.name || "song").replace(/\.[^.]+$/, "");
        setPendingDownloads({
          instrumentalUrl: result.downloadUrl,
          vocalsUrl: result.vocalsUrl,
          filename: baseName
        });
        
        // Try auto-download (works on desktop, may fail on mobile Safari)
        setDownloadingStem("no_vocals");
        const a1 = document.createElement("a");
        a1.href = result.downloadUrl;
        a1.download = `${baseName}_instrumental.mp3`;
        a1.click();
        
        await new Promise(r => setTimeout(r, 1500));
        
        setDownloadingStem("vocals");
        const a2 = document.createElement("a");
        a2.href = result.vocalsUrl;
        a2.download = `${baseName}_vocals.mp3`;
        a2.click();
        
        await new Promise(r => setTimeout(r, 500));
        setDownloadingStem(null);
      } else {
        // Single stem
        const baseName = (file?.name || "song").replace(/\.[^.]+$/, "");
        setPendingDownloads({
          instrumentalUrl: stem === "no_vocals" ? result.downloadUrl : undefined,
          vocalsUrl: stem === "vocals" ? result.downloadUrl : undefined,
          filename: baseName
        });
        
        const a1 = document.createElement("a");
        a1.href = result.downloadUrl;
        a1.download = `${baseName}_${stem === "vocals" ? "vocals" : "instrumental"}.mp3`;
        a1.click();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProcessing(null);
      setDownloadingStem(null);
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
                  className="h-full rounded-full transition-all duration-300 bg-[#C9A84C]"
                  style={{ width: `${demucsProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download Ready - Manual fallback for mobile Safari */}
      {pendingDownloads && (
        <div className="mt-6 p-4 bg-[#C9A84C]/20 rounded-lg border border-[#C9A84C]">
          <p className="text-[#C9A84C] font-semibold mb-3">Download Ready! (Tap buttons if auto-download didn&apos;t work)</p>
          <div className="flex flex-wrap gap-3">
            {pendingDownloads.instrumentalUrl && (
              <a
                href={pendingDownloads.instrumentalUrl}
                download={`${pendingDownloads.filename}_instrumental.mp3`}
                className="px-4 py-2 bg-[#C9A84C] text-[#151515] rounded-lg font-semibold hover:bg-[#C9A84C]/80 transition-colors"
                onClick={() => {}}
              >
                Instrumental
              </a>
            )}
            {pendingDownloads.vocalsUrl && (
              <a
                href={pendingDownloads.vocalsUrl}
                download={`${pendingDownloads.filename}_vocals.mp3`}
                className="px-4 py-2 bg-[#C9A84C] text-[#151515] rounded-lg font-semibold hover:bg-[#C9A84C]/80 transition-colors"
                onClick={() => {}}
              >
                Vocals
              </a>
            )}
          </div>
          <button
            onClick={() => setPendingDownloads(null)}
            className="mt-3 text-sm text-gray-400 hover:text-white underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
