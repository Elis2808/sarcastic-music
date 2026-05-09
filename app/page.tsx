"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import KeyFinder from "./components/KeyFinder";
import BpmFinder from "./components/BpmFinder";
import VoiceRemover from "./components/VoiceRemover";
import FileConverter from "./components/FileConverter";

export default function Home() {
  const [activePage, setActivePage] = useState<"rhyme" | "key" | "bpm" | "voice" | "youtube" | "dictionary" | "converter">("rhyme");
  const [previousPage, setPreviousPage] = useState<string | null>(null);

  function navigateTo(page: "rhyme" | "key" | "bpm" | "voice" | "youtube" | "dictionary" | "converter") {
    setPreviousPage(activePage);
    setActivePage(page);
  }

  // Dictionary state
  const [dictSearch, setDictSearch] = useState("");
  const [dictResult, setDictResult] = useState<{
    word: string;
    phonetic?: string;
    source: string;
    definitions: { partOfSpeech: string; definition: string; example?: string }[];
  } | null>(null);
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState("");

  const lookupWord = useCallback(async (w: string) => {
    if (!w.trim()) { setDictResult(null); setDictError(""); return; }
    setDictLoading(true);
    setDictError("");
    setDictResult(null);
    try {
      const res = await fetch(`/api/define?word=${encodeURIComponent(w.trim())}`);
      const data = await res.json();
      if (!res.ok) { setDictError("Word not found."); }
      else { setDictResult(data); }
    } catch { setDictError("Could not fetch definition."); }
    finally { setDictLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => lookupWord(dictSearch), 500);
    return () => clearTimeout(t);
  }, [dictSearch, lookupWord]);

  // Scroll to last clicked word when returning to rhyme page
  useEffect(() => {
    if (activePage === "rhyme" && lastClickedWord && lastClickedRef.current) {
      setTimeout(() => {
        lastClickedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [activePage]);

  // Downloader state
  const [ytUrl, setYtUrl] = useState("");
  const [ytInfo, setYtInfo] = useState<{ title: string; author: string; lengthSeconds: string; thumbnail: string } | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState("");
  const [ytDownloading, setYtDownloading] = useState<"mp3" | "mp4" | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("YouTube");

  const PLATFORMS = [
    { name: "YouTube", placeholder: "Paste YouTube URL here" },
    { name: "TikTok", placeholder: "Paste TikTok URL here" },
    { name: "Instagram", placeholder: "Paste Instagram URL here" },
    { name: "Facebook", placeholder: "Paste Facebook URL here" },
    { name: "Twitter", placeholder: "Paste Twitter/X URL here" },
    { name: "SoundCloud", placeholder: "Paste SoundCloud URL here" },
    { name: "Vimeo", placeholder: "Paste Vimeo URL here" },
    { name: "Twitch", placeholder: "Paste Twitch URL here" },
  ];

  async function fetchYtInfo() {
    if (!ytUrl.trim()) return;
    setYtLoading(true);
    setYtError("");
    setYtInfo(null);
    try {
      // Use yt-dlp API with cookies for all platforms
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setYtError(data.error || "Something went wrong.");
      } else {
        setYtInfo(data);
      }
    } catch {
      setYtError("Network error. Please try again.");
    } finally {
      setYtLoading(false);
    }
  }

  async function handleDownload(format: "mp3" | "mp4") {
    setYtDownloading(format);
    try {
      // Use yt-dlp API with cookies for all platforms
      const res = await fetch(`/api/youtube?url=${encodeURIComponent(ytUrl)}&format=${format}`);
      if (!res.ok) {
        const data = await res.json();
        setYtError(data.error || "Download failed.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${ytInfo?.title || "download"}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setYtError("Download failed. Please try again.");
    } finally {
      setYtDownloading(null);
    }
  }

  function formatDuration(seconds: string) {
    const s = parseInt(seconds);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem.toString().padStart(2, "0")}`;
  }

  type RhymeData = {
    results: {word: string; category: string}[];
    allResults: {word: string; category: string}[];
    categories: { perfect: string[]; sounding: string[]; near: string[] };
    totalFound: number;
  };

  const [word, setWord] = useState("");
  const [wordList, setWordList] = useState<string[]>([]);
  const [rhymeMap, setRhymeMap] = useState<Record<string, RhymeData>>({});
  const [activeTab, setActiveTab] = useState<"top" | "all" | "perfect" | "sounding" | "near">("top");
  const [isLoading, setIsLoading] = useState(false);
  const [lastClickedWord, setLastClickedWord] = useState("");
  const [rhymeMode, setRhymeMode] = useState<"basic" | "advanced">("basic");
  const [advancedFilter, setAdvancedFilter] = useState<"all" | "noun" | "verb" | "adjective" | "slang" | "name">("all");
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const sliderTrackRef = useRef<HTMLDivElement | null>(null);
  const lastClickedRef = useRef<HTMLSpanElement | null>(null);

  // Slider handlers - supports both click and drag
  const handleSliderClick = (e: React.MouseEvent) => {
    updateSliderFromMouse(e);
  };

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    updateSliderFromMouse(e);
    setIsDraggingSlider(true);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateSliderFromMouse(moveEvent);
    };
    
    const handleMouseUp = () => {
      setIsDraggingSlider(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Reset advanced filter when switching to basic
  useEffect(() => {
    if (rhymeMode === "basic") {
      setAdvancedFilter("all");
    }
  }, [rhymeMode]);

  const updateSliderFromMouse = (e: MouseEvent | React.MouseEvent) => {
    if (!sliderTrackRef.current) return;
    const rect = sliderTrackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    setRhymeMode(percentage < 0.5 ? "basic" : "advanced");
  };

  let timeoutId: NodeJS.Timeout;

  // Get single text color based on advanced filter selection
  const getAdvancedTextColor = (filter: string): string => {
    const colors: Record<string, string> = {
      noun: "text-orange-400",
      verb: "text-cyan-400",
      adjective: "text-pink-400",
      slang: "text-[#C9A84C]",
      name: "text-purple-400",
      all: "text-white"
    };
    return colors[filter] || colors.all;
  };

  // Cache for word type lookups
  const [wordTypeCache, setWordTypeCache] = useState<Record<string, string[]>>({});

  // Detect word types using fast pattern matching (no API calls during render)
  const getWordTypes = (word: string): string[] => {
    if (!word || typeof word !== 'string') return ["noun"];
    
    const w = word.toLowerCase().trim();
    
    // Check cache first
    if (wordTypeCache[w]) {
      return wordTypeCache[w];
    }
    
    const types: string[] = [];
    
    // Fast pattern matching - no async operations
    // Strong verb indicators
    if (/\w+(ing|ed|ize|ise|ify)$/.test(w)) {
      types.push("verb");
    }
    // Strong noun indicators
    if (/\w+(tion|sion|ment|ness|ity|dom|ship)$/.test(w)) {
      types.push("noun");
    }
    // Strong adjective indicators
    if (/\w+(ful|ous|ive|less|able|ible|ic|al)$/.test(w)) {
      types.push("adjective");
    }
    
    // If still no types, default to noun
    if (types.length === 0) {
      types.push("noun");
    }
    
    // Update cache synchronously
    setWordTypeCache(prev => ({ ...prev, [w]: types }));
    return types;
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
    if (words.length === 0) {
      setWordList([]);
      setRhymeMap({});
      return;
    }
    setIsLoading(true);
    try {
      const results = await Promise.all(words.map(w => fetchOne(w)));
      const map: Record<string, RhymeData> = {};
      words.forEach((w, i) => { map[w] = results[i]; });
      setWordList(words);
      setRhymeMap(map);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchOne]);

  // Debounced search as user types
  useEffect(() => {
    timeoutId = setTimeout(() => { search(word); }, 300);
    return () => clearTimeout(timeoutId);
  }, [word, search]);

  async function handleSearch() { await search(word); }


  return (
    <main className="relative flex min-h-screen flex-col items-center bg-black text-white pt-8">

      <img
        src="/logo.png"
        alt="Sarcastic Music"
        className="mb-8 h-10 object-contain"
      />

      {/* Page Nav */}
      <div className="flex gap-2 mb-6 max-sm:flex-wrap max-sm:justify-center">
        <button
          onClick={() => navigateTo("rhyme")}
          className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "rhyme"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Rhyme Finder
        </button>
        <button
          onClick={() => navigateTo("key")}
          className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "key"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Key Finder
        </button>
        <button
          onClick={() => navigateTo("bpm")}
          className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "bpm"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          BPM Finder
        </button>
        <button
          onClick={() => navigateTo("voice")}
          className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "voice"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Song Splitter
        </button>
        <button
          onClick={() => navigateTo("youtube")}
          className={`w-44 px-2 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "youtube"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {selectedPlatform} Downloader
        </button>
        <button
          onClick={() => navigateTo("converter")}
          className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "converter"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          File Converter
        </button>
        <button
          onClick={() => navigateTo("dictionary")}
          className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
            activePage === "dictionary"
              ? "bg-black text-white border border-[#C9A84C]"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Dictionary
        </button>
      </div>

      {/* Key Finder Page */}
      {activePage === "key" && <KeyFinder />}

      {/* BPM Finder Page */}
      {activePage === "bpm" && <BpmFinder />}

      {/* Voice Remover Page */}
      {activePage === "voice" && <VoiceRemover />}

      {/* File Converter Page */}
      {activePage === "converter" && <FileConverter />}

      {/* Downloader Page */}
      {activePage === "youtube" && (
        <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3">
          <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">{selectedPlatform} Downloader</h1>

          <div className="grid grid-cols-4 max-sm:grid-cols-2 gap-2 mb-4 w-full max-w-xl">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.name}
                onClick={() => setSelectedPlatform(platform.name)}
                className={`px-3 py-1.5 rounded-xl bg-black border text-xs transition-all duration-200 ${
                  selectedPlatform === platform.name
                    ? "border-[#C9A84C] text-[#C9A84C]"
                    : "border-gray-600 text-white hover:border-[#C9A84C] hover:text-[#C9A84C]"
                }`}
              >
                {platform.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full max-w-xl max-sm:flex-col">
            <input
              value={ytUrl}
              onChange={(e) => setYtUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") fetchYtInfo(); }}
              placeholder={PLATFORMS.find(p => p.name === selectedPlatform)?.placeholder}
              className="flex-1 px-4 py-3 rounded-xl bg-black border border-gray-600 text-white outline-none focus:ring-2 focus:ring-[#C9A84C]"
            />
            <button
              onClick={fetchYtInfo}
              disabled={ytLoading}
              className="px-6 py-3 rounded-xl bg-black border border-[#C9A84C] hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all duration-200 ease-in-out shadow-lg hover:shadow-[0_0_20px_rgba(201,168,76,0.4)] outline-none focus:ring-2 focus:ring-[#C9A84C] flex items-center justify-center gap-2 max-sm:w-full"
            >
              {ytLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Converting...
                </>
              ) : "Convert"}
            </button>
          </div>

          {ytError && (
            <p className="mt-4 text-red-400 text-sm">{ytError}</p>
          )}

          {ytInfo && (
            <div className="mt-6 w-full max-w-xl bg-gray-900 rounded-lg p-4 flex gap-4 items-start max-sm:flex-col max-sm:items-center">
              {ytInfo.thumbnail && (
                <img src={ytInfo.thumbnail} alt="thumbnail" className="w-32 h-20 object-cover rounded max-sm:w-full max-sm:h-40" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{ytInfo.title}</p>
                <p className="text-gray-400 text-xs mt-1">{ytInfo.author} · {formatDuration(ytInfo.lengthSeconds)}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleDownload("mp3")}
                    disabled={ytDownloading !== null}
                    className="px-4 py-2 rounded-xl bg-black border border-[#C9A84C] hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 shadow hover:shadow-[0_0_12px_rgba(201,168,76,0.4)] outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  >
                    {ytDownloading === "mp3" ? "Processing..." : "Download MP3"}
                  </button>
                  <button
                    onClick={() => handleDownload("mp4")}
                    disabled={ytDownloading !== null}
                    className="px-4 py-2 rounded-xl bg-black border border-[#C9A84C] hover:bg-gray-900 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-all duration-200 shadow hover:shadow-[0_0_12px_rgba(201,168,76,0.4)] outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  >
                    {ytDownloading === "mp4" ? "Processing..." : "Download MP4"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rhyme Finder Page */}
      {activePage === "rhyme" && (
        <div className="flex flex-col items-center w-full pt-8 px-4 max-sm:pt-6 max-sm:px-3">
          <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Rhyme Finder</h1>

          {/* Basic/Advanced Toggle */}
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
              <span
                className={`absolute top-0 left-0 w-2.5 h-2.5 rounded-full bg-[#C9A84C] transition-transform duration-75 pointer-events-none ${
                  rhymeMode === "advanced" ? "translate-x-14" : "translate-x-0"
                }`}
              />
            </div>
            <button
              onClick={() => setRhymeMode("advanced")}
              className={`text-sm transition-all duration-200 cursor-pointer ${rhymeMode === "advanced" ? "text-[#C9A84C] drop-shadow-[0_0_8px_rgba(201,168,76,0.8)]" : "text-gray-500 hover:text-gray-400"}`}
            >Advanced</button>
          </div>

          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="word place thing"
            className="px-4 py-3 rounded-xl w-full max-w-xl bg-black border border-gray-600 text-white text-center outline-none focus:ring-2 focus:ring-[#C9A84C]"
          />

          {/* Shared Tab Navigation */}
          {wordList.length > 0 && (
            <div className="w-full max-w-6xl mx-auto mt-2">
              {/* Main Tabs - Black with Gold Glow */}
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
                    {tab === "top" ? "Top"
                      : tab === "all" ? "All"
                      : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Color Legend - Basic Mode */}
              {rhymeMode === "basic" && (
                <div className="flex justify-center items-center gap-6 mb-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full"></span> Perfect</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full"></span> Sounding</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full"></span> Near</div>
                </div>
              )}

              {/* Advanced Subtabs - Black with Gold Glow */}
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
                  {/* Legend for Advanced Subtabs - 4 Columns */}
                  <div className="grid grid-cols-4 gap-x-6 gap-y-2 mb-4 text-xs text-gray-400 max-w-md mx-auto">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full"></span> Perfect</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-400 rounded-full"></span> Sounding</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-full"></span> Near</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-400 rounded-full"></span> Noun</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-cyan-400 rounded-full"></span> Verb</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-pink-400 rounded-full"></span> Adjective</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-[#C9A84C] rounded-full"></span> Slang</div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-400 rounded-full"></span> Name</div>
                  </div>
                </>
              )}


              {/* Results */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="text-green-400 text-sm animate-pulse">Searching...</div>
                </div>
              ) : wordList.length === 1 ? (
                /* ── Single word: original pill layout ── */
                <div className="mt-2 w-full pb-8 max-h-96 overflow-y-auto">
                  <div className="flex gap-2 flex-wrap justify-center animate-fadeIn">
                    {(() => {
                      const data = rhymeMap[wordList[0]];
                      if (!data) return null;
                      let displayResults: { word: string; category: string }[] = [];
                      let defaultColorClass = "text-green-400";
                      switch (activeTab) {
                        case "top": displayResults = data.results; break;
                        case "perfect": displayResults = data.categories.perfect.map(r => ({ word: r, category: "perfect" })); break;
                        case "sounding": displayResults = data.categories.sounding.map(r => ({ word: r, category: "sounding" })); defaultColorClass = "text-blue-400"; break;
                        case "near": displayResults = data.categories.near.map(r => ({ word: r, category: "near" })); defaultColorClass = "text-red-400"; break;
                        case "all": displayResults = data.allResults; break;
                      }
                      
                      // In Advanced mode, filter by word type using fast pattern detection
                      if (rhymeMode === "advanced" && advancedFilter !== "all") {
                        displayResults = displayResults.filter(r => {
                          const types = getWordTypes(r.word);
                          return types.includes(advancedFilter);
                        });
                      }
                      
                      const advancedTextColor = rhymeMode === "advanced" ? getAdvancedTextColor(advancedFilter) : null;
                      
                      return displayResults.map((r, i) => {
                        const isSelected = lastClickedWord === r.word.toLowerCase();
                        const isTopThree = activeTab === "top" && i < 3;
                        
                        // All word pills are black with gold glow when selected/hovered
                        const bgClass = isSelected 
                          ? "bg-black border border-[#C9A84C] shadow-[0_0_10px_rgba(201,168,76,0.5)]"
                          : "bg-gray-800 border border-transparent hover:border-[#C9A84C] hover:shadow-[0_0_8px_rgba(201,168,76,0.3)]";
                        // In Advanced mode with word filter, split word colors
                        const firstHalfColor = r.category === "perfect" ? "text-green-400" : r.category === "sounding" ? "text-blue-400" : r.category === "near" ? "text-red-400" : "text-white";
                        const secondHalfColor = rhymeMode === "advanced" && advancedFilter !== "all"
                          ? getAdvancedTextColor(advancedFilter)
                          : firstHalfColor;
                        
                        const mid = Math.ceil(r.word.length / 2);
                        const firstHalf = r.word.slice(0, mid);
                        const secondHalf = r.word.slice(mid);
                        
                        return (
                          <span
                            key={i}
                            ref={isSelected ? lastClickedRef : null}
                            onClick={() => { setLastClickedWord(r.word.toLowerCase()); setDictSearch(r.word.toLowerCase()); navigateTo("dictionary"); }}
                            className={`px-4 py-2 rounded text-lg transition-all duration-200 transform hover:scale-105 cursor-pointer ${bgClass}`}
                          >
                            {rhymeMode === "advanced" && advancedFilter !== "all" ? (
                              <>
                                <span className={firstHalfColor}>{firstHalf}</span>
                                <span className={secondHalfColor}>{secondHalf}</span>
                              </>
                            ) : (
                              <span className={firstHalfColor}>{r.word}</span>
                            )}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                /* ── Multiple words: side-by-side columns ── */
                <div className="grid gap-6 w-full" style={{ gridTemplateColumns: `repeat(${wordList.length}, minmax(0, 1fr))` }}>
                  {wordList.map((w) => {
                    const data = rhymeMap[w];
                    if (!data) return null;
                    let displayResults: { word: string; category: string }[] = [];
                    switch (activeTab) {
                      case "top": displayResults = data.results; break;
                      case "perfect": displayResults = data.categories.perfect.map(r => ({ word: r, category: "perfect" })); break;
                      case "sounding": displayResults = data.categories.sounding.map(r => ({ word: r, category: "sounding" })); break;
                      case "near": displayResults = data.categories.near.map(r => ({ word: r, category: "near" })); break;
                      case "all": displayResults = data.allResults; break;
                    }
                    
                    // In Advanced mode, filter by word type using fast pattern detection
                    if (rhymeMode === "advanced" && advancedFilter !== "all") {
                      displayResults = displayResults.filter(r => {
                        const types = getWordTypes(r.word);
                        return types.includes(advancedFilter);
                      });
                    }
                    return (
                      <div key={w} className="flex flex-col">
                        <h2 className="text-center text-lg font-bold text-[#C9A84C] mb-3 capitalize border-b border-gray-700 pb-2">{w}</h2>
                        <div className="flex flex-wrap gap-2 justify-center max-h-96 overflow-y-auto pb-2">
                          {displayResults.length === 0 ? (
                            <span className="text-gray-500 text-sm">No results</span>
                          ) : displayResults.map((r, i) => {
                            const isSelected = lastClickedWord === r.word.toLowerCase();
                            const isTopThree = activeTab === "top" && i < 3;
                            
                            // All word pills are black with gold glow when selected/hovered
                            const bgClass = isSelected 
                              ? "bg-black border border-[#C9A84C] shadow-[0_0_10px_rgba(201,168,76,0.5)]"
                              : "bg-gray-800 border border-transparent hover:border-[#C9A84C] hover:shadow-[0_0_8px_rgba(201,168,76,0.3)]";
                            // In Advanced mode with word filter, split word colors
                            const firstHalfColor = r.category === "perfect" ? "text-green-400" : r.category === "sounding" ? "text-blue-400" : r.category === "near" ? "text-red-400" : "text-white";
                            const secondHalfColor = rhymeMode === "advanced" && advancedFilter !== "all"
                              ? getAdvancedTextColor(advancedFilter)
                              : firstHalfColor;
                            
                            const mid = Math.ceil(r.word.length / 2);
                            const firstHalf = r.word.slice(0, mid);
                            const secondHalf = r.word.slice(mid);
                            
                            return (
                              <span
                                key={i}
                                ref={isSelected ? lastClickedRef : null}
                                onClick={() => { setLastClickedWord(r.word.toLowerCase()); setDictSearch(r.word.toLowerCase()); navigateTo("dictionary"); }}
                                className={`px-3 py-1 rounded text-sm hover:scale-105 transition-transform cursor-pointer ${bgClass}`}
                              >
                                {rhymeMode === "advanced" && advancedFilter !== "all" ? (
                                  <>
                                    <span className={firstHalfColor}>{firstHalf}</span>
                                    <span className={secondHalfColor}>{secondHalf}</span>
                                  </>
                                ) : (
                                  <span className={firstHalfColor}>{r.word}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </div>
      )}
      {/* Dictionary Page */}
      {activePage === "dictionary" && (
        <div className="flex flex-col items-center w-full pt-8 px-4 pb-12 max-sm:pt-6 max-sm:px-3">
          <h1 className="text-3xl max-sm:text-2xl font-bold mb-4">Dictionary</h1>
          <div className="flex items-center gap-3 mb-6">
            {previousPage === "rhyme" && (
              <button
                onClick={() => navigateTo("rhyme")}
                className="text-[#C9A84C] text-sm border border-[#C9A84C] px-3 py-1 rounded-xl hover:bg-[#C9A84C]/10 transition-colors"
              >
                ← Back to Rhyme Finder
              </button>
            )}
          </div>

          <input
            value={dictSearch}
            onChange={(e) => setDictSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") lookupWord(dictSearch); }}
            placeholder="Search a word..."
            className="px-4 py-3 rounded-xl w-full max-w-md bg-black border border-gray-600 text-white text-center outline-none focus:ring-2 focus:ring-[#C9A84C] mb-8"
          />

          {dictLoading && <p className="text-gray-500 animate-pulse">Looking up...</p>}
          {dictError && (
            <div className="w-full max-w-2xl bg-gray-900 rounded-xl p-6 border border-gray-800 text-center">
              <p className="text-[#C9A84C] font-bold text-2xl capitalize mb-2">{dictSearch}</p>
              <p className="text-gray-500 text-sm">No definition found. This word may be slang, a proper noun, or very niche.</p>
            </div>
          )}

          {dictResult && (
            <div className="w-full max-w-2xl bg-gray-900 rounded-xl p-6 border border-gray-800">
              <div className="flex items-baseline gap-3 mb-1">
                <p className="text-[#C9A84C] font-bold text-2xl capitalize">{dictResult.word}</p>
                {dictResult.phonetic && <p className="text-gray-500 text-sm">{dictResult.phonetic}</p>}
                {dictResult.source === "local" && (
                  <span className="text-xs px-2 py-0.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded-full border border-[#C9A84C]/40">local</span>
                )}
                {dictResult.source === "generic" && (
                  <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full border border-gray-600">term</span>
                )}
              </div>
              <div className="space-y-4 mt-4">
                {dictResult.definitions.map((d, i) => (
                  <div key={i}>
                    <span className="text-xs text-gray-500 italic">{d.partOfSpeech}</span>
                    <p className="text-white text-sm mt-1 leading-relaxed">{d.definition}</p>
                    {d.example && <p className="text-gray-500 text-xs mt-1 italic">&ldquo;{d.example}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!dictLoading && !dictResult && !dictError && !dictSearch.trim() && (
            <p className="text-gray-600 text-sm">Type any word above to see its definition.</p>
          )}
        </div>
      )}
    </main>
  );
}

