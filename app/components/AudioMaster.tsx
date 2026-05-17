"use client";

import { useState, useRef, useCallback } from "react";
import { addHistoryItem } from "../lib/history";
import { showToast } from "./Toast";

interface AudioMasterProps {
  initialUrl?: string;
  initialPlatform?: string;
}

export default function AudioMaster({ initialUrl: _initialUrl, initialPlatform: _initialPlatform }: AudioMasterProps) {
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
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
        {file ? (
          <>
            <p className="text-sm text-[#C9A84C] font-medium truncate">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-300 font-medium">Drop audio file here</p>
            <p className="text-xs text-gray-500 mt-1">or tap to browse</p>
          </>
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
