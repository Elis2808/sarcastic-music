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
  
  // History restore state
  const [restoreState, setRestoreState] = useState<{
    tool?: Page;
    word?: string;
    url?: string;
    platform?: string;
  }>({});

  // Sync with URL params for shareable links
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tool = params.get("tool") as Page;
    const word = params.get("word");
    const url = params.get("url");
    const platform = params.get("platform");
    
    if (tool && ["rhyme", "key", "bpm", "voice", "youtube", "dictionary", "converter"].includes(tool)) {
      setActivePage(tool);
      if (word || url || platform) {
        setRestoreState({ tool, word: word || undefined, url: url || undefined, platform: platform || undefined });
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
      <div className="flex items-center gap-4 mb-8">
        <img src="/logo.png" alt="Sarcastic Music" className="h-10 object-contain" />
        <HistoryMenu onSelect={handleHistorySelect} />
      </div>

      <nav className="flex gap-2 mb-6 w-full max-w-4xl px-4 overflow-x-auto scrollbar-hide max-sm:snap-x max-sm:snap-mandatory">
        {NAV_ITEMS.map(({ page, label }) => (
          <button
            key={page}
            onClick={() => navigateTo(page)}
            className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors whitespace-nowrap flex-shrink-0 max-sm:snap-start ${
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
      {activePage === "key"        && <KeyFinder initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
      {activePage === "bpm"        && <BpmFinder initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
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
