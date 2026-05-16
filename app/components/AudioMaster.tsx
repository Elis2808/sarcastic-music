"use client";

import { useState, useRef, useCallback } from "react";
import { addHistoryItem } from "../lib/history";
import { showToast } from "./Toast";

const PLATFORMS = [
  { id: "youtube", label: "YouTube", placeholder: "Paste YouTube URL here" },
  { id: "soundcloud", label: "SoundCloud", placeholder: "Paste SoundCloud URL here" },
  { id: "tiktok", label: "TikTok", placeholder: "Paste TikTok URL here" },
  { id: "instagram", label: "Instagram", placeholder: "Paste Instagram URL here" },
  { id: "facebook", label: "Facebook", placeholder: "Paste Facebook URL here" },
  { id: "twitter", label: "Twitter/X", placeholder: "Paste Twitter/X URL here" },
  { id: "spotify", label: "Spotify", placeholder: "Paste Spotify URL here" },
  { id: "vimeo", label: "Vimeo", placeholder: "Paste Vimeo URL here" },
];

interface AudioMasterProps {
  initialUrl?: string;
  initialPlatform?: string;
}

export default function AudioMaster({ initialUrl, initialPlatform }: AudioMasterProps) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState(initialUrl || "");
  const [selectedPlatform, setSelectedPlatform] = useState(initialPlatform || "");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedPlat = PLATFORMS.find(p => p.id === selectedPlatform);
  const placeholder = selectedPlat?.placeholder || "Paste a link here";

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); setLinkUrl(""); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setLinkUrl(""); }
  }

  function handleUrlFromDropZone(url: string, platform?: string) {
    setLinkUrl(url);
    setFile(null);
    if (platform) setSelectedPlatform(platform);
  }

  const master = useCallback(async () => {
    if (!file && !linkUrl.trim()) {
      setError("Please upload a file or paste a link.");
      return;
    }
    setError("");
    setProcessing(true);
    setProgress(0);
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);

    // Animate progress bar
    let prog = 0;
    const progInterval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 3, 90);
      setProgress(Math.round(prog));
    }, 800);

    try {
      const form = new FormData();
      if (file) {
        form.append("file", file);
      } else {
        form.append("url", linkUrl.trim());
        form.append("platform", selectedPlatform);
      }

      const res = await fetch("/api/master", { method: "POST", body: form });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Mastering failed");
      }

      setProgress(100);
      clearInterval(progInterval);

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      const baseName = file?.name.replace(/\.[^.]+$/, "") || "audio";
      a.download = `${baseName}_mastered.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 10000);

      addHistoryItem({
        type: "audio_master",
        title: file?.name || linkUrl,
        details: "Audio mastered",
        data: { tool: "master", url: linkUrl, platform: selectedPlatform },
      });

      showToast("Mastered file downloaded!", "success");
    } catch (err: any) {
      clearInterval(progInterval);
      setError(err.message || "Something went wrong");
      showToast(err.message || "Mastering failed", "error");
    } finally {
      clearInterval(progInterval);
      if (timerRef.current) clearInterval(timerRef.current);
      setProcessing(false);
    }
  }, [file, linkUrl, selectedPlatform]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white pt-6 sm:pt-10 px-3 sm:px-4">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">Audio Master</h1>
      <p className="text-gray-400 text-sm mb-6 text-center max-w-sm">
        Professional mastering — loudness normalization, EQ, compression & limiting
      </p>

      {/* Platform Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-2 mb-3 max-w-full px-1" style={{ scrollbarWidth: "none" }}>
        {PLATFORMS.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPlatform(p.id === selectedPlatform ? "" : p.id)}
            className={`px-3 py-1.5 rounded-xl border text-xs transition-all whitespace-nowrap flex-shrink-0 ${
              selectedPlatform === p.id
                ? "border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10"
                : "border-gray-600 text-gray-300 hover:border-[#C9A84C] hover:text-[#C9A84C]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* URL Input */}
      <div className="relative w-full max-w-xl mb-3">
        <input
          type="text"
          value={linkUrl}
          onChange={e => { setLinkUrl(e.target.value); setFile(null); }}
          placeholder={placeholder}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C9A84C] transition-colors"
        />
      </div>

      {/* File Upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-xl border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-6 ${
          dragging ? "border-[#C9A84C] bg-[#C9A84C]/5" : "border-gray-700 hover:border-gray-500"
        }`}
      >
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
        {file ? (
          <p className="text-sm text-[#C9A84C]">{file.name}</p>
        ) : (
          <p className="text-sm text-gray-400">Drop audio file here or click to browse</p>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

      {/* Master Button */}
      <button
        onClick={master}
        disabled={processing}
        className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all ${
          processing
            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
            : "bg-[#C9A84C] hover:bg-[#b8953d] text-black"
        }`}
      >
        {processing ? "Mastering..." : "Master Audio"}
      </button>

      {/* Progress */}
      {processing && (
        <div className="mt-6 w-full max-w-xl">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Processing... {elapsed}s</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-[#C9A84C] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Applying EQ, compression, loudness normalization & limiting...
          </p>
        </div>
      )}

      {/* What it does */}
      {!processing && (
        <div className="mt-8 w-full max-w-xl grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Loudness", desc: "-14 LUFS streaming standard" },
            { label: "EQ", desc: "Low end boost, mud cut, air" },
            { label: "Compression", desc: "Dynamic range control" },
            { label: "Limiting", desc: "True peak limit at -1 dBTP" },
          ].map(item => (
            <div key={item.label} className="bg-gray-900 rounded-xl p-3 text-center border border-gray-800">
              <p className="text-[#C9A84C] text-xs font-semibold mb-1">{item.label}</p>
              <p className="text-gray-400 text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
