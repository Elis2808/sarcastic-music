"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

type RhymeData = {
  results: { word: string; category: string }[];
  allResults: { word: string; category: string }[];
  categories: { perfect: string[]; sounding: string[]; near: string[]; written: string[] };
  totalFound: number;
};

import { addHistoryItem } from "../lib/history";

interface Props {
  onLookupWord: (word: string) => void;
  highlightWord?: string;
  initialWord?: string;
  onWordChange?: (word: string) => void;
}

const CATEGORY_TEXT_CLASS: Record<string, string> = {
  perfect: "text-green-400",
  sounding: "text-blue-400",
  near: "text-red-400",
  written: "text-yellow-400",
};

const ADVANCED_COLOR: Record<string, string> = {
  noun: "text-orange-400",
  verb: "text-cyan-400",
  adjective: "text-pink-400",
  slang: "text-lime-400",
  name: "text-purple-400",
  all: "text-white",
};

const SLANG_WORDS = new Set(["drip","flex","lowkey","highkey","slay","cap","bussin","fire","lit","vibe","goat","dope","sauce","plug","bag","bread","guap","racks","bands","clout","stan","slap","bop","hard","cold","icy","wave","deadass","bet","facts","fam","bruh","sis","bro","homie","crew","squad","og","sus","mid","woke","gas","hype","bars","rizz","based","cringe","spit","grind","hustle","trash","wack","corny","basic","extra","thirsty","simp","ghost","vibe","chill","fresh","clean","heat","tea","shade","beef","smoke","fade","finesse","tweakin","trippin","buggin","pressed","salty","tight","heated","turnt","hyped","hater","mad","brick","wildin","clap","murk","body","rip","ethered","bodied","ratio","cancel","sus","suss","fr","ngl","tbh","periodt","lowkey","highkey","deadass","bet","facts","drip","flex","slay","cap","bussin","fire","lit","dope","sauce","plug","bag","clout","stan","slap","bop","hard","cold","icy","wave","rizz","based","cringe","spit","bars","grind","hustle","hype","goat","woke","gas","simp","ghost","chill","fresh","clean","heat","tea","shade","beef","smoke","fade","finesse","pressed","salty","heated","turnt","hyped","hater","trash","wack","corny","basic","extra","thirsty"]);

function getWordTypes(word: string, cache: Record<string, string[]>): string[] {
  if (!word) return ["noun"];
  const w = word.toLowerCase().trim();
  if (cache[w]) return cache[w];
  const types: string[] = [];
  if (/\w+(ing|ed|ize|ise|ify)$/.test(w)) types.push("verb");
  if (/\w+(tion|sion|ment|ness|ity|dom|ship)$/.test(w)) types.push("noun");
  if (/\w+(ful|ous|ive|less|able|ible|ic|al)$/.test(w)) types.push("adjective");
  if (SLANG_WORDS.has(w)) types.push("slang");
  if (/^[A-Z][a-z]+$/.test(word.trim()) || /\w+(son|ton|man|ley|ster|ito|isha|ion|ell)$/.test(w)) types.push("name");
  if (types.length === 0) types.push("noun");
  return types;
}

interface PillListProps {
  results: { word: string; category: string }[];
  lastClicked: string;
  onClickWord: (w: string) => void;
  rhymeMode: "basic" | "advanced";
  wordTypeCache: Record<string, string[]>;
}

const PillList = React.memo(function PillList({ results, lastClicked, onClickWord, rhymeMode, wordTypeCache }: PillListProps) {
  return (
    <div className="mt-2 w-full pb-8 max-h-[32rem] overflow-y-auto">
      <div className="flex gap-2 flex-wrap justify-center">
        {results.map((r, i) => {
          const isSelected = lastClicked === r.word.toLowerCase();
          const types = wordTypeCache[r.word.toLowerCase()] || getWordTypes(r.word, wordTypeCache);
          const primaryType = types[0] || "noun";
          const posColor = ADVANCED_COLOR[primaryType] || "text-white";
          const rhymeTextClass = CATEGORY_TEXT_CLASS[r.category] || "text-white";
          const textColorClass = rhymeMode === "advanced" ? posColor : rhymeTextClass;
          const borderClass = `rhyme-pill rhyme-pill-${r.category}${isSelected ? " rhyme-pill-selected" : ""}`;
          return (
            <span
              key={i}
              onClick={() => onClickWord(r.word)}
              className={`px-4 py-2 text-lg rounded-lg cursor-pointer bg-gray-900 ${borderClass} ${textColorClass}`}
            >
              {r.word}
            </span>
          );
        })}
      </div>
    </div>
  );
});

export default function RhymeFinder({ onLookupWord, highlightWord, initialWord, onWordChange }: Props) {
  const [word, setWord] = useState("");
  const [lastClickedWord, setLastClickedWord] = useState(highlightWord || "");
  const [wordList, setWordList] = useState<string[]>([]);
  const [rhymeMap, setRhymeMap] = useState<Record<string, RhymeData>>({});
  const [activeTab, setActiveTab] = useState<"top" | "all" | "perfect" | "sounding" | "near" | "written">("top");
  const [isLoading, setIsLoading] = useState(false);
  const [rhymeMode, setRhymeMode] = useState<"basic" | "advanced">("basic");
  const [advancedFilter, setAdvancedFilter] = useState<"all" | "noun" | "verb" | "adjective" | "slang" | "name">("all");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const wordTypeCache = useRef<Record<string, string[]>>({}).current;
  const [rhymeFilter, setRhymeFilter] = useState("");
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const lastClickedRef = useRef<HTMLSpanElement | null>(null);

  // Add optimized CSS for rhyme pills
  useEffect(() => {
    const id = "rhyme-pill-style";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `
        .rhyme-pill {
          position: relative;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          will-change: transform;
        }
        .rhyme-pill:hover {
          transform: scale(1.05);
        }
        .rhyme-pill-perfect {
          border: 2px solid #4ade80;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.3);
        }
        .rhyme-pill-sounding {
          border: 2px solid #60a5fa;
          box-shadow: 0 0 8px rgba(96, 165, 250, 0.3);
        }
        .rhyme-pill-near {
          border: 2px solid #f87171;
          box-shadow: 0 0 8px rgba(248, 113, 113, 0.3);
        }
        .rhyme-pill-written {
          border: 2px solid #facc15;
          box-shadow: 0 0 8px rgba(250, 204, 21, 0.3);
        }
        .rhyme-pill-selected {
          border-color: #C9A84C !important;
          box-shadow: 0 0 12px rgba(201, 168, 76, 0.5) !important;
        }
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
          border-radius: 9999px;
          padding: 3px;
          background: #111;
          will-change: transform;
          contain: layout style;
        }
        .btn-sweep-wrapper::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
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

  // Update lastClickedWord when highlightWord prop changes, then scroll to it
  useEffect(() => {
    if (highlightWord) {
      setLastClickedWord(highlightWord.toLowerCase());
      // Wait for results to render, then scroll the highlighted pill into view
      const scrollToHighlight = () => {
        if (lastClickedRef.current) {
          lastClickedRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      // Try immediately, then retry after render cycles
      const t1 = setTimeout(scrollToHighlight, 100);
      const t2 = setTimeout(scrollToHighlight, 400);
      const t3 = setTimeout(scrollToHighlight, 900);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [highlightWord]);

  // Set initial word from history
  useEffect(() => {
    if (initialWord) {
      setWord(initialWord);
      search(initialWord);
    }
  }, [initialWord]);

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
      categories: data.categories || { perfect: [], sounding: [], near: [], written: [] },
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
      
      // Add to history
      if (words.length > 0) {
        addHistoryItem({
          type: "rhyme_search",
          title: words.join(" "),
          details: `${words.length} word${words.length > 1 ? 's' : ''} searched`,
          data: {
            tool: "rhyme",
            word: input.trim(),
          },
        });
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchOne]);

  useEffect(() => {
    const t = setTimeout(() => search(word), 250);
    return () => clearTimeout(t);
  }, [word, search]);

  // Memoized word type cache computation
  const memoizedWordTypes = useMemo(() => {
    const cache: Record<string, string[]> = {};
    wordList.forEach(w => {
      rhymeMap[w]?.allResults.forEach(r => {
        const lw = r.word.toLowerCase();
        if (!cache[lw]) {
          cache[lw] = getWordTypes(r.word, wordTypeCache);
        }
      });
    });
    return cache;
  }, [rhymeMap, wordList]);

  function getCachedWordTypes(w: string): string[] {
    const lw = w.toLowerCase();
    if (memoizedWordTypes[lw]) return memoizedWordTypes[lw];
    return getWordTypes(w, wordTypeCache); // never setState during render
  }

  // Memoized display results to avoid recalculation on every render
  const displayResultsMap = useMemo(() => {
    const map: Record<string, { word: string; category: string }[]> = {};
    wordList.forEach(w => {
      const data = rhymeMap[w];
      if (!data) return;
      
      let results: { word: string; category: string }[] = [];
      switch (activeTab) {
        case "top":     results = data.results; break;
        case "perfect": results = data.categories.perfect.map(r => ({ word: r, category: "perfect" })); break;
        case "sounding":results = data.categories.sounding.map(r => ({ word: r, category: "sounding" })); break;
        case "near":    results = data.categories.near.map(r => ({ word: r, category: "near" })); break;
        case "written": results = (data.categories.written || []).map(r => ({ word: r, category: "written" })); break;
        case "all":     results = data.allResults; break;
      }
      
      if (rhymeMode === "advanced" && advancedFilter !== "all") {
        results = results.filter(r => getCachedWordTypes(r.word).includes(advancedFilter));
      }
      
      if (rhymeFilter.trim()) {
        const filter = rhymeFilter.toLowerCase();
        results = results.filter(r => r.word.toLowerCase().includes(filter));
      }
      
      // Cap to 200 for performance — "all" can have thousands of entries
      map[w] = results.slice(0, 200);
    });
    return map;
  }, [rhymeMap, wordList, activeTab, rhymeMode, advancedFilter, rhymeFilter, memoizedWordTypes]);

  // Memoized total results count
  const totalResultsCount = useMemo(() => {
    return wordList.reduce((sum, w) => sum + (displayResultsMap[w]?.length || 0), 0);
  }, [wordList, displayResultsMap]);

  function handleWordClick(w: string) {
    const lower = w.toLowerCase();
    setLastClickedWord(lower);
    onLookupWord(lower);
  }

  function renderWordPill(r: { word: string; category: string }, i: number, small = false) {
    const isSelected = lastClickedWord === r.word.toLowerCase();
    const rhymeTextClass = CATEGORY_TEXT_CLASS[r.category] || "text-white";

    // Get word types for advanced mode
    const wordTypes = getCachedWordTypes(r.word);
    const primaryType = wordTypes[0] || "noun";
    const posColor = ADVANCED_COLOR[primaryType] || "text-white";

    // Basic mode: text color = rhyme quality color
    // Advanced mode: text color = part-of-speech color
    const textColorClass = rhymeMode === "advanced" ? posColor : rhymeTextClass;

    // Border always based on rhyme quality (even in advanced mode)
    const borderClass = `rhyme-pill rhyme-pill-${r.category} ${isSelected ? "rhyme-pill-selected" : ""}`;

    return (
      <span
        key={i}
        ref={isSelected ? lastClickedRef : null}
        onClick={() => handleWordClick(r.word)}
        className={`${small ? "px-3 py-1 text-sm" : "px-4 py-2 text-lg"} rounded-lg cursor-pointer bg-gray-900 ${borderClass} ${textColorClass}`}
      >
        {r.word}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3">
      <h1 className="text-3xl max-sm:text-2xl font-bold mb-1">Rhyme Finder</h1>
      <p className="text-gray-500 text-xs mb-4">Made by artists, with today&apos;s language.</p>

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

      <div className="relative w-full max-w-xl">
        <input
          value={word}
          onChange={(e) => { setWord(e.target.value); onWordChange?.(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter") search(word); }}
          placeholder="Type any word to find related rhymes"
          className="px-4 pr-12 py-3 rounded-full w-full bg-black text-white text-center outline-none focus:ring-2 focus:ring-[#C9A84C] placeholder-gray-500"
          style={{ border: "1px solid rgba(201,168,76,0.25)" }}
        />
        <svg onClick={() => search(word)} className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 hover:text-[#C9A84C] cursor-pointer transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </div>
      <div className={`mt-3 w-36 ${isLoading ? "btn-sweep-wrapper" : "rounded-full border border-[#C9A84C]"}`}>
        <button
          onClick={() => search(word)}
          disabled={isLoading || !word.trim()}
          className="w-full px-4 py-2.5 rounded-full bg-black text-white text-sm font-medium disabled:cursor-not-allowed transition-all duration-200 outline-none"
        >
          {isLoading ? <span className="text-[#C9A84C]">Searching...</span> : "Search"}
        </button>
      </div>

      {wordList.length > 0 && (
        <div className="w-full max-w-6xl mx-auto mt-2">
          {/* Search filter for rhymes */}
          <div className="mb-3 flex justify-center">
            <div className="relative w-full max-w-xs">
              <input
                value={rhymeFilter}
                onChange={(e) => setRhymeFilter(e.target.value)}
                placeholder="Filter rhymes..."
                className="w-full px-3 py-2 pl-9 rounded-full bg-black border border-[rgba(255,255,255,0.07)] text-white text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] placeholder-gray-500"
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

          <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide justify-center w-full">
            {(["top", "perfect", "sounding", "near", "written", "all"] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => {
                    if (tab === "top") { setActiveTab("top"); return; }
                    setActiveTab(isActive ? "top" : tab);
                  }}
                  className="px-3 py-2 rounded-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50 shrink-0"
                  style={{
                    backgroundColor: isActive ? "rgba(201,168,76,0.13)" : "transparent",
                    color: isActive ? "rgba(255,240,205,0.96)" : "rgba(255,255,255,0.48)",
                    border: "1px solid " + (isActive ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)"),
                    transition: "color 160ms ease-out, background-color 160ms ease-out, border-color 160ms ease-out",
                  }}
                >
                  {tab === "top" ? "Top" : tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              );
            })}
          </div>

          {rhymeMode === "basic" && (
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-400 overflow-x-auto scrollbar-hide flex-nowrap px-1">
              <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-green-400 rounded-full" /> Perfect</div>
              <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-blue-400 rounded-full" /> Sounding</div>
              <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-red-400 rounded-full" /> Near</div>
              <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-yellow-400 rounded-full" /> Written</div>
            </div>
          )}

          {rhymeMode === "advanced" && (
            <>
              <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide flex-nowrap px-1">
                {(["noun", "verb", "adjective", "slang", "name"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAdvancedFilter(prev => prev === filter ? "all" : filter)}
                    className="px-2 py-1 rounded-full text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]/50"
                    style={{
                      backgroundColor: advancedFilter === filter ? "rgba(201,168,76,0.13)" : "transparent",
                      color: advancedFilter === filter ? "rgba(255,240,205,0.96)" : "rgba(255,255,255,0.48)",
                      border: "1px solid " + (advancedFilter === filter ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)"),
                      transition: "color 160ms ease-out, background-color 160ms ease-out, border-color 160ms ease-out",
                    }}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              <div className="mb-4 text-xs text-gray-400 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-4 flex-nowrap px-1 mb-1">
                  <span className="text-gray-600 flex-shrink-0">Border:</span>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 rounded-full" style={{background:"#4ade80"}} /> Perfect</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 rounded-full" style={{background:"#60a5fa"}} /> Sounding</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 rounded-full" style={{background:"#f87171"}} /> Near</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 rounded-full" style={{background:"#facc15"}} /> Written</div>
                </div>
                <div className="flex items-center gap-4 flex-nowrap px-1">
                  <span className="text-gray-600 flex-shrink-0">Text:</span>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-orange-400 rounded-full" /> Noun</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-cyan-400 rounded-full" /> Verb</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-pink-400 rounded-full" /> Adjective</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-lime-400 rounded-full" /> Slang</div>
                  <div className="flex items-center gap-1 flex-shrink-0"><span className="w-2 h-2 bg-purple-400 rounded-full" /> Name</div>
                </div>
              </div>
            </>
          )}

          {/* Results count */}
          {!isLoading && wordList.length > 0 && (
            <div className="text-center mb-2">
              <span className="text-xs text-gray-500">
                {totalResultsCount} result{totalResultsCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-green-400 text-sm">Searching...</div>
            </div>
          ) : wordList.length === 1 ? (
            <PillList results={displayResultsMap[wordList[0]] || []} lastClicked={lastClickedWord} onClickWord={handleWordClick} rhymeMode={rhymeMode} wordTypeCache={wordTypeCache} />
          ) : (
            <>
            <div className="flex flex-col gap-6 sm:hidden w-full">
              {wordList.map((w) => {
                const results = displayResultsMap[w] || [];
                return (
                  <div key={w} className="flex flex-col min-w-0">
                    <h2 className="text-center text-lg font-bold text-[#C9A84C] mb-3 capitalize border-b border-gray-700 pb-2">{w}</h2>
                    <div className="flex flex-wrap gap-2 justify-center max-h-64 overflow-y-auto pb-2">
                      {results.length === 0
                        ? <span className="text-gray-500 text-sm">No results</span>
                        : results.map((r, i) => renderWordPill(r, i, true))
                      }
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden sm:grid gap-4 w-full" style={{ gridTemplateColumns: `repeat(${Math.min(wordList.length, 3)}, minmax(280px, 1fr))` }}>
              {wordList.map((w) => {
                const results = displayResultsMap[w] || [];
                return (
                  <div key={w} className="flex flex-col min-w-0">
                    <h2 className="text-center text-lg font-bold text-[#C9A84C] mb-3 capitalize border-b border-gray-700 pb-2 truncate">{w}</h2>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
