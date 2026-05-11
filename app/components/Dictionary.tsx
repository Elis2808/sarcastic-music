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
}

export default function Dictionary({ initialWord = "", onBack }: Props) {
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
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Dictionary</h1>

      {onBack && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="text-[#C9A84C] text-sm border border-[#C9A84C] px-3 py-1 rounded-xl hover:bg-[#C9A84C]/10 transition-colors"
          >
            ← Back to Rhyme Finder
          </button>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") lookupWord(search); }}
        placeholder="Search a word..."
        className="px-4 py-3 rounded-xl w-full max-w-md bg-black border border-gray-600 text-white text-center outline-none focus:ring-2 focus:ring-[#C9A84C] mb-8"
      />

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

      {!loading && !result && !error && !search.trim() && (
        <p className="text-gray-600 text-sm">Type any word above to see its definition.</p>
      )}
    </div>
  );
}
