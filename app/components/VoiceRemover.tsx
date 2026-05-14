"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type StemType = "no_vocals" | "vocals" | "both";

const FORMATS = [
  { ext: "mp3", label: "MP3", desc: "Universal audio format" },
  { ext: "wav", label: "WAV", desc: "Uncompressed, high quality" },
  { ext: "flac", label: "FLAC", desc: "Lossless compression" },
  { ext: "m4a", label: "M4A", desc: "Apple/AAC format" },
];

export default function VoiceRemover() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [processing, setProcessing] = useState<StemType | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [demucsProgress, setDemucsProgress] = useState(0);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showFormats, setShowFormats] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("mp3");
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
    setDownloadPct(null);
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
        formData.append("stem", stem === "both" ? "no_vocals" : stem);
        
        const startRes = await fetch("/api/separate", { method: "POST", body: formData });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || "Failed to start processing");
        jobId = startData.jobId;
      } else {
        // Process file upload
        const formData = new FormData();
        formData.append("file", file!);
        formData.append("stem", stem === "both" ? "no_vocals" : stem);
        
        const startRes = await fetch("/api/separate", { method: "POST", body: formData });
        const startData = await startRes.json();
        if (!startRes.ok) throw new Error(startData.error || "Failed to start processing");
        jobId = startData.jobId;
      }

      // For "both" - need to start second job for vocals
      let vocalsJobId: string | null = null;
      if (stem === "both") {
        if (linkUrl.trim()) {
          const linkRes = await fetch("/api/youtube", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: linkUrl.trim(), format: "mp3" }),
          });
          const audioBlob = await linkRes.blob();
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.mp3");
          formData.append("stem", "vocals");
          const startRes = await fetch("/api/separate", { method: "POST", body: formData });
          const startData = await startRes.json();
          vocalsJobId = startData.jobId;
        } else {
          const formData = new FormData();
          formData.append("file", file!);
          formData.append("stem", "vocals");
          const startRes = await fetch("/api/separate", { method: "POST", body: formData });
          const startData = await startRes.json();
          vocalsJobId = startData.jobId;
        }
      }

      // Poll for first job
      const pollJob = async (jid: string, isVocals: boolean): Promise<string> => {
        const deadline = Date.now() + 8 * 60 * 1000;
        while (true) {
          if (Date.now() > deadline) throw new Error("Processing timed out.");
          await new Promise(r => setTimeout(r, 4000));
          const pollRes = await fetch(`/api/separate?id=${jid}`);
          const pollData = await pollRes.json().catch(() => ({}));
          if (pollRes.status === 404) continue;
          if (!pollRes.ok) throw new Error(pollData.error || "Processing failed");
          if (pollData.status === "error") throw new Error(pollData.error || "Processing failed");
          if (typeof pollData.progress === "number") setDemucsProgress(pollData.progress);
          if (pollData.downloadUrl) return pollData.downloadUrl;
        }
      };

      const instrumentalUrl = await pollJob(jobId, false);
      const a1 = document.createElement("a");
      a1.href = instrumentalUrl;
      a1.download = `${(file?.name || "song").replace(/\.[^.]+$/, "")}_instrumental.mp3`;
      a1.click();

      if (vocalsJobId && stem === "both") {
        const vocalsUrl = await pollJob(vocalsJobId, true);
        const a2 = document.createElement("a");
        a2.href = vocalsUrl;
        a2.download = `${(file?.name || "song").replace(/\.[^.]+$/, "")}_vocals.mp3`;
        a2.click();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProcessing(null);
      setElapsed(0);
      setDemucsProgress(0);
      setDownloadPct(null);
    }
  }, [file, linkUrl]);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 select-none max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Song Splitter</h1>

      {/* Link input section */}
      <div className="flex gap-2 w-full max-w-xl max-sm:flex-col mb-4">
        <div className="relative flex-1">
          <input
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); setFile(null); }}
            placeholder="Paste any audio link (YouTube, SoundCloud, etc.)"
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
        <div className={`max-sm:w-full ${processing ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-700"}`}>
          <button
            onClick={() => setShowFormats(!showFormats)}
            disabled={processing !== null}
            className="px-4 py-3 rounded-[10px] bg-black hover:bg-gray-900 text-white text-sm font-medium transition-all duration-200 outline-none whitespace-nowrap"
          >
            Format: {FORMATS.find(f => f.ext === selectedFormat)?.label}
          </button>
        </div>
      </div>

      {/* Formats sidebar */}
      {showFormats && (
        <div className="w-full max-w-xl mb-4 bg-gray-900 rounded-xl p-3 border border-gray-700">
          <p className="text-gray-500 text-xs mb-2">Select download format:</p>
          <div className="flex gap-2 flex-wrap">
            {FORMATS.map((fmt) => (
              <button
                key={fmt.ext}
                onClick={() => { setSelectedFormat(fmt.ext); setShowFormats(false); }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                  selectedFormat === fmt.ext
                    ? "bg-[#C9A84C] text-black font-medium"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone - only show when no link entered */}
      {!linkUrl && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !file && inputRef.current?.click()}
          className={`w-full max-w-xl max-sm:h-40 h-52 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all duration-200 ${
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
              <p className="text-gray-400 text-sm">{dragging ? "Drop It!" : "Or drop an audio file here"}</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
        </div>
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
            <div className={`flex-1 ${processing === "no_vocals" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-700"}`}>
              <button
                onClick={() => download("no_vocals")}
                disabled={processing !== null}
                className="w-full px-4 py-3 rounded-[10px] bg-black border border-[#C9A84C] hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 outline-none"
              >
                {processing === "no_vocals" ? (
                  <span className="text-[#C9A84C] text-xs">Processing…</span>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    <span className="text-xs">Instrumental</span>
                  </>
                )}
              </button>
            </div>

            {/* Both button with connecting lines */}
            <div className="relative flex flex-col items-center">
              {/* Connecting lines */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-gradient-to-r from-gray-600 to-[#C9A84C]" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-[2px] bg-gradient-to-l from-gray-600 to-[#C9A84C]" />
              
              <div className={`${processing === "both" ? "btn-sweep-wrapper" : "rounded-lg p-[2px] bg-gray-600"}`}>
                <button
                  onClick={() => download("both")}
                  disabled={processing !== null}
                  className="px-3 py-2 rounded-[6px] bg-black border border-gray-500 hover:border-[#C9A84C] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 outline-none whitespace-nowrap"
                >
                  {processing === "both" ? (
                    <span className="text-[#C9A84C]">Both…</span>
                  ) : (
                    "Both"
                  )}
                </button>
              </div>
            </div>

            {/* Vocals */}
            <div className={`flex-1 ${processing === "vocals" ? "btn-sweep-wrapper" : "rounded-xl p-[3px] bg-gray-700"}`}>
              <button
                onClick={() => download("vocals")}
                disabled={processing !== null}
                className="w-full px-4 py-3 rounded-[10px] bg-black border border-gray-500 hover:border-[#C9A84C] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 outline-none"
              >
                {processing === "vocals" ? (
                  <span className="text-[#C9A84C] text-xs">Processing…</span>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="text-xs">Vocals</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-gray-600 text-xs mt-2 text-center">Processing may take 30–60 seconds on GPU</p>
        </div>
      )}
    </div>
  );
}
