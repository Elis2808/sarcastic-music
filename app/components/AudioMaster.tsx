"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { addHistoryItem } from "../lib/history";
import { showToast } from "./Toast";
import { showRateLimitModal } from "./RateLimitModal";

interface AudioMasterProps {
  initialUrl?: string;
  initialPlatform?: string;
}

export default function AudioMaster({ initialUrl: _initialUrl, initialPlatform: _initialPlatform }: AudioMasterProps) {
  useEffect(() => {
    if (document.getElementById("audio-master-sweep-style")) return;
    const style = document.createElement("style");
    style.id = "audio-master-sweep-style";
    style.textContent = `
      @property --sweep-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
      @keyframes btn-sweep { to { --sweep-angle: 360deg; } }
      .btn-sweep-wrapper { position: relative; border-radius: 9999px; padding: 3px; background: #111; will-change: transform; contain: layout style; }
      .btn-sweep-wrapper::before { content: ''; position: absolute; inset: 0; border-radius: 9999px; padding: 3px; background: conic-gradient(from var(--sweep-angle), transparent 0deg, transparent 270deg, #C9A84C 310deg, #e8c96a 340deg, #C9A84C 360deg); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; animation: btn-sweep 1.4s linear infinite; }
    `;
    document.head.appendChild(style);
  }, []);

  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  const master = useCallback(async () => {
    if (!file) {
      setError("Please upload an audio file.");
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
      form.append("file", file);

      const res = await fetch("/api/master", { method: "POST", body: form });
      if (res.status === 429) { showRateLimitModal("master", 40); setProcessing(false); clearInterval(progInterval); return; }

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
        title: file.name,
        details: "Audio mastered",
        data: { tool: "master" },
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
  }, [file]);

  return (
    <div className="flex flex-col items-center bg-black text-white pt-8 pb-12 px-4 w-full min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-white">Audio Master</h1>
      <p className="text-gray-500 text-xs mb-4 text-center">
        Professional mastering for optimizing sound on multiple devices.
      </p>

      {/* File Upload */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full max-w-md border-2 rounded-2xl p-8 text-center cursor-pointer transition-all mb-6 ${
          dragging ? "border-[#C9A84C] bg-black" : file ? "border-[#C9A84C] bg-black" : "border-[#C9A84C]/40 bg-black hover:border-[#C9A84C]"
        }`}
      >
        <input ref={inputRef} type="file" accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac,.aiff,.aif,.wma,.opus,.mp4" className="hidden" onChange={handleFileChange} />
        {file ? (
          <>
            <p className="text-sm text-[#C9A84C] font-medium truncate">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </>
        ) : (
          <>
            <svg className={`w-10 h-10 mx-auto mb-2 transition-colors ${dragging ? "text-[#C9A84C]" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-300 font-medium">Drop audio file here</p>
            <p className="text-xs text-gray-500 mt-1">or tap to browse</p>
          </>
        )}
      </div>

      {/* Error */}
      {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

      {/* Master Button */}
      <div className={`w-36 ${processing ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]"}`}>
        <button
          onClick={master}
          disabled={processing}
          className="w-full px-4 py-2.5 rounded-full bg-black text-white text-sm font-medium disabled:cursor-not-allowed transition-all duration-200 outline-none"
        >
          {processing ? <span className="text-[#C9A84C]">Mastering...</span> : "Master Audio"}
        </button>
      </div>

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
            { label: "Noise Gate", desc: "Removes background hiss & noise" },
            { label: "Stereo Width", desc: "Widens sound for speakers & headphones" },
            { label: "Compression", desc: "Dense, punchy dynamics +6dB makeup" },
            { label: "Loudness", desc: "-10 LUFS, hard limit at -0.5dBTP" },
          ].map(item => (
            <div
              key={item.label}
              style={{ borderColor: "rgba(201,168,76,0.45)" }}
              className="bg-black rounded-xl p-3 text-center border-2"
            >
              <p className="text-[#C9A84C] text-xs font-semibold mb-1">{item.label}</p>
              <p className="text-white text-xs">{item.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
