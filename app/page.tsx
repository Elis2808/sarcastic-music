"use client";

import { useState, useEffect } from "react";
import KeyFinder from "./components/KeyFinder";
import BpmFinder from "./components/BpmFinder";
import VoiceRemover from "./components/VoiceRemover";
import FileConverter from "./components/FileConverter";
import Downloader from "./components/Downloader";
import RhymeFinder from "./components/RhymeFinder";
import Dictionary from "./components/Dictionary";
import AudioMaster from "./components/AudioMaster";
import HistoryMenu from "./components/HistoryMenu";
import MobileNav from "./components/MobileNav";
import GlassCarousel from "./components/GlassCarousel";
import DesktopNav from "./components/DesktopNav";
import { addHistoryItem, type HistoryItem } from "./lib/history";
import ToastContainer from "./components/Toast";
import { showToast } from "./components/Toast";

type Page = "rhyme" | "key" | "bpm" | "voice" | "youtube" | "dictionary" | "converter" | "master";

export default function Home() {
  const [activePage, setActivePage] = useState<Page>("rhyme");
  const [previousPage, setPreviousPage] = useState<Page | null>(null);
  const [dictWord, setDictWord] = useState("");
  const [lastClickedRhymeWord, setLastClickedRhymeWord] = useState(() => {
    if (typeof sessionStorage !== "undefined") return sessionStorage.getItem("lastRhymeWord") || "";
    return "";
  });
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
      master: "master",
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
    const lower = word.toLowerCase();
    setLastClickedRhymeWord(lower);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("lastRhymeWord", lower);
    addHistoryItem({
      type: "dictionary_lookup",
      title: word,
      details: "Dictionary lookup",
    });
    navigateTo("dictionary");
  }

  const NAV_ITEMS: { page: Page; label: string }[] = [
    { page: "rhyme",      label: "Rhyme Finder" },
    { page: "dictionary", label: "Dictionary" },
    { page: "voice",      label: "Song Splitter" },
    { page: "youtube",    label: "Downloader" },
    { page: "key",        label: "Key Finder" },
    { page: "bpm",        label: "BPM Finder" },
    { page: "converter",  label: "File Converter" },
    { page: "master",     label: "Audio Master" },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-black text-white pt-8">
      <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-6">
        {/* Hamburger Menu Button + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg bg-black text-[#C9A84C] transition-all duration-200"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Click outside overlay */}
          {menuOpen && (
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          )}

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-40 bg-black border border-[#C9A84C]/40 rounded-xl shadow-2xl z-50 overflow-hidden">
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
                        ? "bg-[#C9A84C]/10 text-[#C9A84C] font-medium"
                        : "text-gray-300 hover:text-[#C9A84C] hover:bg-[#C9A84C]/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Logo */}
        <img 
          src="/logo.png" 
          alt="Sarcastic Music" 
          className="h-10 object-contain cursor-pointer hover:opacity-80 transition-opacity relative z-40"
          onClick={() => window.location.reload()}
        />

        {/* History Menu */}
        <HistoryMenu onSelect={handleHistorySelect} />
      </div>

      {/* Desktop nav — environmental wrapper */}
      <div className="hidden sm:block relative" style={{ marginBottom: 24 }}>
        {/* Environmental luminance field — OUTSIDE the nav so backdrop-filter samples it */}
        <div aria-hidden className="absolute pointer-events-none" style={{
          inset: "-28px -56px",
          zIndex: 0,
        }}>
          <div style={{
            position:"absolute", width:"54%", height:"220%",
            top:"-60%", left:"3%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(201,168,76,0.030) 0%, transparent 68%)",
            filter:"blur(24px)",
            animation:"envB1 19s cubic-bezier(0.45,0.05,0.55,0.95) infinite",
            animationDelay:"-7s", willChange:"transform,opacity",
          }} />
          <div style={{
            position:"absolute", width:"42%", height:"190%",
            top:"-50%", right:"5%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(195,215,240,0.020) 0%, transparent 65%)",
            filter:"blur(30px)",
            animation:"envB2 24s cubic-bezier(0.4,0,0.6,1) infinite",
            animationDelay:"-13s", willChange:"transform,opacity",
          }} />
          <div style={{
            position:"absolute", width:"36%", height:"170%",
            top:"-40%", left:"31%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(255,255,255,0.022) 0%, transparent 62%)",
            filter:"blur(20px)",
            animation:"envB3 15s cubic-bezier(0.37,0,0.63,1) infinite",
            animationDelay:"-3s", willChange:"transform,opacity",
          }} />
          <div style={{
            position:"absolute", width:"28%", height:"150%",
            top:"-30%", right:"16%", borderRadius:"50%",
            background:"radial-gradient(circle, rgba(150,100,35,0.016) 0%, transparent 60%)",
            filter:"blur(18px)",
            animation:"envB4 29s cubic-bezier(0.5,0.1,0.5,0.9) infinite",
            animationDelay:"-18s", willChange:"transform,opacity",
          }} />
        </div>
        <style>{`
          @keyframes envB1{0%{transform:scale(1);opacity:1}38%{transform:scale(1.08);opacity:.64}100%{transform:scale(.97);opacity:.9}}
          @keyframes envB2{0%{transform:scale(1.03);opacity:.78}53%{transform:scale(.92);opacity:1}100%{transform:scale(1.01);opacity:.7}}
          @keyframes envB3{0%{transform:scale(.97);opacity:.88}46%{transform:scale(1.10);opacity:.6}100%{transform:scale(1);opacity:1}}
          @keyframes envB4{0%{transform:scale(1.02);opacity:.72}62%{transform:scale(.95);opacity:1}100%{transform:scale(1.04);opacity:.66}}
        `}</style>
        <div style={{ position:"relative", zIndex:1 }}>
          <DesktopNav
            items={NAV_ITEMS}
            activePage={activePage}
            onNavigate={(page) => {
              if (page === "rhyme" && activePage === "rhyme") window.location.reload();
              else navigateTo(page as Page);
            }}
          />
        </div>
      </div>

      {/* Mobile nav — auto-scrolling + swipeable */}
      <MobileNav
        items={NAV_ITEMS}
        activePage={activePage}
        onNavigate={(page: string) => {
          if (page === "rhyme" && activePage === "rhyme") window.location.reload();
          else navigateTo(page as Page);
        }}
      />

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
      {activePage === "master"     && <AudioMaster initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
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
