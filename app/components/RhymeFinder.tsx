"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type RhymeData = {
  results: { word: string; category: string }[];
  allResults: { word: string; category: string }[];
  categories: { perfect: string[]; sounding: string[]; near: string[] };
  totalFound: number;
};

interface Props {
  onLookupWord: (word: string) => void;
  highlightWord?: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  perfect: "#4ade80",    // green-400
  sounding: "#60a5fa",   // blue-400
  near: "#f87171",       // red-400
};

const CATEGORY_TEXT_CLASS: Record<string, string> = {
  perfect: "text-green-400",
  sounding: "text-blue-400",
  near: "text-red-400",
};

const ADVANCED_COLOR: Record<string, string> = {
  noun: "text-orange-400",
  verb: "text-cyan-400",
  adjective: "text-pink-400",
  slang: "text-[#C9A84C]",
  name: "text-purple-400",
  all: "text-white",
};

function getWordTypes(word: string, cache: Record<string, string[]>): string[] {
  if (!word) return ["noun"];
  const w = word.toLowerCase().trim();
  if (cache[w]) return cache[w];
  const types: string[] = [];
  if (/\w+(ing|ed|ize|ise|ify)$/.test(w)) types.push("verb");
  if (/\w+(tion|sion|ment|ness|ity|dom|ship)$/.test(w)) types.push("noun");
  if (/\w+(ful|ous|ive|less|able|ible|ic|al)$/.test(w)) types.push("adjective");
  if (types.length === 0) types.push("noun");
  return types;
}

export default function RhymeFinder({ onLookupWord, highlightWord }: Props) {
  const [word, setWord] = useState("");
  const [lastClickedWord, setLastClickedWord] = useState(highlightWord || "");
  const [wordList, setWordList] = useState<string[]>([]);
  const [rhymeMap, setRhymeMap] = useState<Record<string, RhymeData>>({});
  const [activeTab, setActiveTab] = useState<"top" | "all" | "perfect" | "sounding" | "near">("top");
  const [isLoading, setIsLoading] = useState(false);
  const [rhymeMode, setRhymeMode] = useState<"basic" | "advanced">("basic");
  const [advancedFilter, setAdvancedFilter] = useState<"all" | "noun" | "verb" | "adjective" | "slang" | "name">("all");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [wordTypeCache, setWordTypeCache] = useState<Record<string, string[]>>({});
  const [rhymeFilter, setRhymeFilter] = useState("");
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const lastClickedRef = useRef<HTMLSpanElement | null>(null);

  // Add CSS animation for rotating borders
  useEffect(() => {
    const id = "rhyme-sweep-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        @property --sweep-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes rhyme-sweep {
          from { --sweep-angle: 0deg; }
          to { --sweep-angle: 360deg; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Update lastClickedWord when highlightWord prop changes
  useEffect(() => {
    if (highlightWord) {
      setLastClickedWord(highlightWord.toLowerCase());
    }
  }, [highlightWord]);

  useEffect(() => {
    if (rhymeMode === "basic") setAdvancedFilter("all");
  }, [rhymeMode]);

  // Clear rhyme filter when word list changes
  useEffect(() => {
    setRhymeFilter("");
  }, [wordList]);

  const updateSliderFromMouse = (e: MouseEvent | React.MouseEvent) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setRhymeMode(x / rect.width < 0.5 ? "basic" : "advanced");
  };

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    updateSliderFromMouse(e);
    setIsDraggingSlider(true);
    const onMove = (ev: MouseEvent) => updateSliderFromMouse(ev);
    const onUp = () => {
      setIsDraggingSlider(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const fetchOne = useCallback(async (w: string): Promise<RhymeData> => {
    const res = await fetch("/api/rhyme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: w }),
    });
    const data = await res.json();
    return {
      results: data.results || [],
      allResults: data.allResults || [],
      categories: data.categories || { perfect: [], sounding: [], near: [] },
      totalFound: data.totalFound || 0,
    };
  }, []);

  const search = useCallback(async (input: string) => {
    const words = input.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) { setWordList([]); setRhymeMap({}); return; }
    setIsLoading(true);
    try {
      const results = await Promise.all(words.map(w => fetchOne(w)));
      const map: Record<string, RhymeData> = {};
      words.forEach((w, i) => { map[w] = results[i]; });
      setWordList(words);
      setRhymeMap(map);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchOne]);

  useEffect(() => {
    const t = setTimeout(() => search(word), 300);
    return () => clearTimeout(t);
  }, [word, search]);

  function getCachedWordTypes(w: string): string[] {
    const types = getWordTypes(w, wordTypeCache);
    if (!wordTypeCache[w.toLowerCase()]) {
      setWordTypeCache(prev => ({ ...prev, [w.toLowerCase()]: types }));
    }
    return types;
  }

  function handleWordClick(w: string) {
    setLastClickedWord(w.toLowerCase());
    onLookupWord(w.toLowerCase());
  }

  function renderWordPill(r: { word: string; category: string }, i: number, small = false) {
    const isSelected = lastClickedWord === r.word.toLowerCase();
    const rhymeColor = CATEGORY_COLOR[r.category] || "#ffffff";
    const rhymeTextClass = CATEGORY_TEXT_CLASS[r.category] || "text-white";

    // Get word types for advanced mode
    const wordTypes = getCachedWordTypes(r.word);
    const primaryType = wordTypes[0] || "noun";
    const posColor = ADVANCED_COLOR[primaryType] || "text-white";

    // Basic mode: text color = rhyme quality color
    // Advanced mode: text color = part-of-speech color
    const textColorClass = rhymeMode === "advanced" ? posColor : rhymeTextClass;

    // Wrapper style with rotating border based on rhyme quality
    const wrapperStyle: React.CSSProperties = {
      background: `conic-gradient(from var(--sweep-angle, 0deg), ${rhymeColor}, ${rhymeColor}40, ${rhymeColor})`,
      borderRadius: "0.5rem",
      padding: "2px",
      animation: "rhyme-sweep 2s linear infinite",
    };

    // Inner pill style
    const innerClass = isSelected
      ? "bg-black border border-[#C9A84C] shadow-[0_0_10px_rgba(201,168,76,0.5)]"
      : "bg-gray-900 border border-transparent";

    return (
      <span
        key={i}
        ref={isSelected ? lastClickedRef : null}
        onClick={() => handleWordClick(r.word)}
        className="inline-block"
        style={wrapperStyle}
      >
        <span
          className={`${small ? "px-3 py-1 text-sm" : "px-4 py-2 text-lg"} rounded transition-all duration-200 transform hover:scale-105 cursor-pointer block ${innerClass} ${textColorClass}`}
        >
          {r.word}
        </span>
      </span>
    );
  }

  function getDisplayResults(data: RhymeData) {
    let results: { word: string; category: string }[] = [];
    switch (activeTab) {
      case "top":     results = data.results; break;
      case "perfect": results = data.categories.perfect.map(r => ({ word: r, category: "perfect" })); break;
      case "sounding":results = data.categories.sounding.map(r => ({ word: r, category: "sounding" })); break;
      case "near":    results = data.categories.near.map(r => ({ word: r, category: "near" })); break;
      case "all":     results = data.allResults; break;
    }
    if (rhymeMode === "advanced" && advancedFilter !== "all") {
      results = results.filter(r => getCachedWordTypes(r.word).includes(advancedFilter));
    }
    // Apply text filter
    if (rhymeFilter.trim()) {
      const filter = rhymeFilter.toLowerCase();
      results = results.filter(r => r.word.toLowerCase().includes(filter));
    }
    return results;
  }

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Rhyme Finder</h1>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setRhymeMode("basic")}
          className={`text-sm transition-all duration-200 cursor-pointer ${rhymeMode === "basic" ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}
        >Basic</button>
        <div
          ref={sliderTrackRef}
          onMouseDown={handleSliderMouseDown}
          className={`relative w-16 h-2.5 rounded-full bg-gray-700 transition-all duration-200 cursor-pointer ${isDraggingSlider ? "bg-gray-600" : ""}`}
        >
          <span className={`absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-[#C9A84C] transition-transform duration-75 pointer-events-none ${rhymeMode === "advanced" ? "translate-x-14" : "translate-x-0"}`} />
        </div>
        <button
          onClick={() => setRhymeMode("advanced")}
          className={`text-sm transition-all duration-200 cursor-pointer ${rhymeMode === "advanced" ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}
        >Advanced</button>
      </div>

      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") search(word); }}
        placeholder="word place thing"
        className="px-4 py-3 rounded-xl w-full max-w-xl bg-black border border-gray-600 text-white text-center outline-none focus:ring-2 focus:ring-[#C9A84C]"
      />

      {wordList.length > 0 && (
        <div className="w-full max-w-6xl mx-auto mt-2">
          {/* Search filter for rhymes */}
          <div className="mb-3 flex justify-center">
            <div className="relative w-full max-w-xs">
              <input
                value={rhymeFilter}
                onChange={(e) => setRhymeFilter(e.target.value)}
                placeholder="Filter rhymes..."
                className="w-full px-3 py-2 pl-9 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] placeholder-gray-500"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {rhymeFilter && (
                <button
                  onClick={() => setRhymeFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-700 rounded text-gray-500 hover:text-gray-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 mb-2 justify-center flex-wrap">
            {(["top", "perfect", "sounding", "near", "all"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-xl transition-all duration-200 text-sm outline-none ${
                  activeTab === tab
                    ? "bg-black text-[#C9A84C] border border-[#C9A84C] shadow-[0_0_10px_rgba(201,168,76,0.5)]"
                    : "bg-gray-800 text-gray-300 hover:text-[#C9A84C] hover:border-[#C9A84C]/50 border border-transparent"
                }`}
              >
                {tab === "top" ? "Top" : tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {rhymeMode === "basic" && (
            <div className="flex justify-center items-center gap-6 mb-4 text-xs text-gray-400">
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full" /> Perfect</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full" /> Sounding</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" /> Near</div>
            </div>
          )}

          {rhymeMode === "advanced" && (
            <>
              <div className="flex gap-2 mb-2 justify-center flex-wrap">
                {(["noun", "verb", "adjective", "slang", "name"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAdvancedFilter(filter)}
                    className={`px-2 py-1 rounded-lg transition-all duration-200 text-xs outline-none ${
                      advancedFilter === filter
                        ? "bg-black text-[#C9A84C] border border-[#C9A84C] shadow-[0_0_8px_rgba(201,168,76,0.5)]"
                        : "bg-gray-800/50 text-gray-400 hover:text-[#C9A84C] hover:border-[#C9A84C]/50 border border-transparent"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-x-6 gap-y-2 mb-4 text-xs text-gray-400 max-w-md mx-auto">
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full" /> Perfect</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full" /> Sounding</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full" /> Near</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-400 rounded-full" /> Noun</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-400 rounded-full" /> Verb</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-400 rounded-full" /> Adjective</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#C9A84C] rounded-full" /> Slang</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-400 rounded-full" /> Name</div>
              </div>
            </>
          )}

          {/* Results count */}
          {!isLoading && wordList.length > 0 && (
            <div className="text-center mb-2">
              <span className="text-xs text-gray-500">
                {(() => {
                  const total = wordList.reduce((sum, w) => sum + getDisplayResults(rhymeMap[w]).length, 0);
                  return `${total} result${total !== 1 ? 's' : ''}`;
                })()}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-green-400 text-sm animate-pulse">Searching...</div>
            </div>
          ) : wordList.length === 1 ? (
            <div className="mt-2 w-full pb-8 max-h-96 overflow-y-auto">
              <div className="flex gap-2 flex-wrap justify-center animate-fadeIn">
                {getDisplayResults(rhymeMap[wordList[0]]).map((r, i) => renderWordPill(r, i, false))}
              </div>
            </div>
          ) : (
            <div className="grid gap-6 w-full" style={{ gridTemplateColumns: `repeat(${wordList.length}, minmax(0, 1fr))` }}>
              {wordList.map((w) => {
                const data = rhymeMap[w];
                if (!data) return null;
                const results = getDisplayResults(data);
                return (
                  <div key={w} className="flex flex-col">
                    <h2 className="text-center text-lg font-bold text-[#C9A84C] mb-3 capitalize border-b border-gray-700 pb-2">{w}</h2>
                    <div className="flex flex-wrap gap-2 justify-center max-h-96 overflow-y-auto pb-2">
                      {results.length === 0
                        ? <span className="text-gray-500 text-sm">No results</span>
                        : results.map((r, i) => renderWordPill(r, i, true))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
