"use client";

import { useState, useEffect, useCallback } from "react";

type DictResult = {
  word: string;
  phonetic?: string;
  source: string;
  definitions: { partOfSpeech: string; definition: string; example?: string }[];
};

interface Props {
  initialWord?: string;
  onBack?: () => void;
  onWordChange?: (word: string) => void;
}

export default function Dictionary({ initialWord = "", onBack, onWordChange }: Props) {
  const [search, setSearch] = useState(initialWord);
  const [result, setResult] = useState<DictResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookupWord = useCallback(async (w: string) => {
    if (!w.trim()) { setResult(null); setError(""); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/define?word=${encodeURIComponent(w.trim())}`);
      const data = await res.json();
      if (!res.ok) setError("Word not found.");
      else setResult(data);
    } catch {
      setError("Could not fetch definition.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => lookupWord(search), 500);
    return () => clearTimeout(t);
  }, [search, lookupWord]);

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 pb-12 max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">Dictionary</h1>
      <p className="text-gray-500 text-xs mb-4">Search to define a word.</p>

      {onBack && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="text-sm px-4 py-1.5 rounded-full font-semibold transition-all"
            style={{
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.45)",
              color: "#C9A84C",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,168,76,0.22)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(201,168,76,0.12)")}
          >
            ← Back to Rhyme Finder
          </button>
        </div>
      )}

      <div className="relative w-full max-w-md mb-8">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); onWordChange?.(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") lookupWord(search); }}
          placeholder="Search a word"
          className="px-4 pr-12 py-3 rounded-full w-full bg-black text-white text-center outline-none focus:ring-2 focus:ring-[#C9A84C]"
          style={{ border: "1px solid rgba(201,168,76,0.25)" }}
        />
        <svg onClick={() => lookupWord(search)} className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 hover:text-[#C9A84C] cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>

      {loading && <p className="text-gray-500 animate-pulse">Looking up...</p>}

      {error && (
        <div className="w-full max-w-2xl bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
          <p className="text-[#C9A84C] font-bold text-2xl capitalize mb-2">{search}</p>
          <p className="text-gray-500 text-sm">No definition found. This word may be slang, a proper noun, or very niche.</p>
        </div>
      )}

      {result && (
        <div className="w-full max-w-2xl bg-gray-900 rounded-xl p-6 border border-gray-800">
          <div className="flex items-baseline gap-3 mb-1">
            <p className="text-[#C9A84C] font-bold text-2xl capitalize">{result.word}</p>
            {result.phonetic && <p className="text-gray-500 text-sm">{result.phonetic}</p>}
            {result.source === "local" && (
              <span className="text-xs px-2 py-0.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded-full border border-[#C9A84C]/40">local</span>
            )}
            {result.source === "generic" && (
              <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full border border-gray-600">term</span>
            )}
          </div>
          <div className="space-y-4 mt-4">
            {result.definitions.map((d, i) => (
              <div key={i}>
                <span className="text-xs text-gray-500 italic">{d.partOfSpeech}</span>
                <p className="text-white text-sm mt-1 leading-relaxed">{d.definition}</p>
                {d.example && <p className="text-gray-500 text-xs mt-1 italic">&ldquo;{d.example}&rdquo;</p>}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
