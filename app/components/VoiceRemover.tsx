"use client";

import { useState, useRef, useCallback } from "react";

type StemType = "no_vocals" | "vocals";

export default function VoiceRemover() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<StemType | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!file) return;
    setProcessing(stem);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("stem", stem);

      const res = await fetch("/api/separate", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Processing failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_${stem === "no_vocals" ? "instrumental" : "vocals"}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    } finally {
      setProcessing(null);
    }
  }, [file]);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 select-none max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Song Splitter</h1>

      {/* Drop zone */}
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
            <p className="text-gray-400 text-sm">{dragging ? "Drop It!" : "Drop An Audio File To Split A Song Into Instrumental And Vocals"}</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onFileChange} />
      </div>

      {/* Error */}
      {error && <p className="mt-4 text-red-400 text-sm text-center max-w-md">{error}</p>}

      {/* Download buttons */}
      {file && (
        <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-xs">
          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Download as</p>

          <button
            onClick={() => download("no_vocals")}
            disabled={processing !== null}
            className="w-full px-6 py-4 rounded-xl bg-black border border-[#C9A84C] hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all duration-200 shadow-lg hover:shadow-[#C9A84C]/30 flex items-center justify-center gap-3 outline-none focus:ring-2 focus:ring-[#C9A84C]"
          >
            {processing === "no_vocals" ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                Instrumental (No Vocals)
              </>
            )}
          </button>

          <button
            onClick={() => download("vocals")}
            disabled={processing !== null}
            className="w-full px-6 py-4 rounded-xl bg-black border border-gray-600 hover:border-gray-400 hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all duration-200 flex items-center justify-center gap-3 outline-none focus:ring-2 focus:ring-[#C9A84C]"
          >
            {processing === "vocals" ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Processing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Vocals Only
              </>
            )}
          </button>

          <p className="text-gray-600 text-xs mt-2 text-center">Processing may take 1–3 minutes depending on song length</p>
        </div>
      )}
    </div>
  );
}
