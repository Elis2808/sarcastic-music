"use client";

import { useState, useEffect } from "react";
import KeyFinder from "./components/KeyFinder";
import BpmFinder from "./components/BpmFinder";
import VoiceRemover from "./components/VoiceRemover";
import FileConverter from "./components/FileConverter";
import Downloader from "./components/Downloader";
import RhymeFinder from "./components/RhymeFinder";
import Dictionary from "./components/Dictionary";
import HistoryMenu from "./components/HistoryMenu";
import { addHistoryItem, type HistoryItem } from "./lib/history";
import ToastContainer from "./components/Toast";
import { showToast } from "./components/Toast";

type Page = "rhyme" | "key" | "bpm" | "voice" | "youtube" | "dictionary" | "converter";

export default function Home() {
  const [activePage, setActivePage] = useState<Page>("rhyme");
  const [previousPage, setPreviousPage] = useState<Page | null>(null);
  const [dictWord, setDictWord] = useState("");
  const [lastClickedRhymeWord, setLastClickedRhymeWord] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  
  // History restore state
  const [restoreState, setRestoreState] = useState<{
    tool?: Page;
    word?: string;
    url?: string;
    platform?: string;
    key?: string;
    scale?: string;
    strength?: number;
    relativeKey?: string;
    relativeScale?: string;
    bpm?: number;
    timeSignature?: string;
    beatCount?: number;
  }>({});

  // Sync with URL params for shareable links
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool") as Page;
    const word = params.get("word");
    const url = params.get("url");
    const platform = params.get("platform");
    const key = params.get("key");
    const scale = params.get("scale");
    const strength = params.get("strength");
    const relativeKey = params.get("relativeKey");
    const relativeScale = params.get("relativeScale");
    const bpm = params.get("bpm");
    const timeSignature = params.get("timeSignature");
    const beatCount = params.get("beatCount");
    
    if (tool && ["rhyme", "key", "bpm", "voice", "youtube", "dictionary", "converter"].includes(tool)) {
      setActivePage(tool);
      const newState: typeof restoreState = { tool };
      if (word) newState.word = word;
      if (url) newState.url = url;
      if (platform) newState.platform = platform;
      if (key) newState.key = key;
      if (scale) newState.scale = scale;
      if (strength) newState.strength = parseFloat(strength);
      if (relativeKey) newState.relativeKey = relativeKey;
      if (relativeScale) newState.relativeScale = relativeScale;
      if (bpm) newState.bpm = parseFloat(bpm);
      if (timeSignature) newState.timeSignature = timeSignature;
      if (beatCount) newState.beatCount = parseInt(beatCount);
      if (Object.keys(newState).length > 1) {
        setRestoreState(newState);
      }
    }
  }, []);

  // Update URL when navigating
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set("tool", activePage);
    if (restoreState.word) params.set("word", restoreState.word);
    if (restoreState.url) params.set("url", restoreState.url);
    if (restoreState.platform) params.set("platform", restoreState.platform);
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [activePage, restoreState]);

  function navigateTo(page: Page, state?: { word?: string; url?: string; platform?: string }) {
    setPreviousPage(activePage);
    setActivePage(page);
    if (state) {
      setRestoreState(state);
    }
  }

  // Handle history item selection
  function handleHistorySelect(item: HistoryItem) {
    if (!item.data?.tool) return;
    
    const tool = item.data.tool;
    const toolMap: Record<string, Page> = {
      rhyme: "rhyme",
      key: "key",
      bpm: "bpm",
      voice: "voice",
      youtube: "youtube",
      dictionary: "dictionary",
    };
    
    const page = toolMap[tool];
    if (!page) return;
    
    navigateTo(page, {
      word: item.data.word,
      url: item.data.url,
      platform: item.data.platform,
    });
  }

  function openDictionary(word: string) {
    setDictWord(word);
    setLastClickedRhymeWord(word.toLowerCase());
    addHistoryItem({
      type: "dictionary_lookup",
      title: word,
      details: "Dictionary lookup",
    });
    navigateTo("dictionary");
  }

  const NAV_ITEMS: { page: Page; label: string }[] = [
    { page: "rhyme",     label: "Rhyme Finder" },
    { page: "key",       label: "Key Finder" },
    { page: "bpm",       label: "BPM Finder" },
    { page: "voice",     label: "Song Splitter" },
    { page: "youtube",   label: "Downloader" },
    { page: "converter", label: "File Converter" },
    { page: "dictionary",label: "Dictionary" },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-black text-white pt-8">
      <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-8">
        {/* Hamburger Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-all duration-200"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo */}
        <img 
          src="/logo.png" 
          alt="Sarcastic Music" 
          className="h-10 object-contain cursor-pointer hover:opacity-80 transition-opacity relative z-40"
          onClick={() => window.location.reload()}
        />

        {/* History Menu */}
        <HistoryMenu onSelect={handleHistorySelect} />

        {/* Click outside overlay - behind menu */}
        {menuOpen && (
          <div
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* Dropdown Menu Overlay */}
        {menuOpen && (
          <div className="absolute top-14 left-0 sm:left-0 sm:right-auto sm:w-40 w-40 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden">
            <div className="p-1">
              {NAV_ITEMS.map(({ page, label }) => (
                <button
                  key={page}
                  onClick={() => {
                    if (page === "rhyme" && activePage === "rhyme") {
                      window.location.reload();
                    } else {
                      navigateTo(page);
                      setMenuOpen(false);
                    }
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    activePage === page
                      ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                      : "text-white hover:bg-gray-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <nav className="flex flex-wrap justify-center gap-2 max-sm:gap-1.5 max-sm:px-2">
        {NAV_ITEMS.map(({ page, label }) => (
          <button
            key={page}
            onClick={() => {
              if (page === "rhyme" && activePage === "rhyme") {
                window.location.reload();
              } else {
                navigateTo(page);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm outline-none transition-colors whitespace-nowrap ${
              activePage === page
                ? "bg-black text-white border border-[#C9A84C]"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {activePage === "rhyme"      && <RhymeFinder onLookupWord={openDictionary} highlightWord={lastClickedRhymeWord} initialWord={restoreState.word} />}
      {activePage === "key"        && <KeyFinder 
        initialUrl={restoreState.url} 
        initialPlatform={restoreState.platform}
        initialKey={restoreState.key}
        initialScale={restoreState.scale}
        initialStrength={restoreState.strength}
        initialRelativeKey={restoreState.relativeKey}
        initialRelativeScale={restoreState.relativeScale}
      />}
      {activePage === "bpm"        && <BpmFinder 
        initialUrl={restoreState.url} 
        initialPlatform={restoreState.platform}
        initialBpm={restoreState.bpm}
        initialTimeSignature={restoreState.timeSignature}
        initialBeatCount={restoreState.beatCount}
      />}
      {activePage === "voice"      && <VoiceRemover initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
      {activePage === "youtube"    && <Downloader initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
      {activePage === "converter"  && <FileConverter />}
      {activePage === "dictionary" && (
        <Dictionary
          initialWord={dictWord}
          onBack={previousPage === "rhyme" ? () => { setLastClickedRhymeWord(dictWord.toLowerCase()); navigateTo("rhyme"); } : undefined}
        />
      )}
      <ToastContainer />
    </main>
  );
}
