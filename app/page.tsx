"use client";

import { useState, useEffect, useRef } from "react";
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
import BannerAd from "./components/BannerAd";
import RateLimitModal from "./components/RateLimitModal";

type Page = "rhyme" | "key" | "bpm" | "voice" | "youtube" | "dictionary" | "converter" | "master";

export default function Home() {
  const [activePage, setActivePage] = useState<Page>("rhyme");
  const [previousPage, setPreviousPage] = useState<Page | null>(null);
  const [dictWord, setDictWord] = useState("");
  const [lastRhymeSearch, setLastRhymeSearch] = useState("");
  const [lastClickedRhymeWord, setLastClickedRhymeWord] = useState(() => {
    if (typeof sessionStorage !== "undefined") return sessionStorage.getItem("lastRhymeWord") || "";
    return "";
  });
  const liveRhymeWord = useRef("");
  const liveDictWord = useRef("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredMenuItem, setHoveredMenuItem] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = dropdownRef.current;
    if (!el || !menuOpen) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      const btn = target?.closest('[data-menu-page]') as HTMLElement | null;
      setHoveredMenuItem(btn?.dataset.menuPage ?? null);
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [menuOpen]);

  useEffect(() => {
    if (document.getElementById("glass-btn-style")) return;
    const s = document.createElement("style");
    s.id = "glass-btn-style";
    s.textContent = `.glass-btn { transition: border-color 200ms ease, box-shadow 200ms ease, color 200ms ease; } .glass-btn:hover, .glass-btn:active { border-color: rgba(201,168,76,0.5) !important; box-shadow: 0 0 14px rgba(201,168,76,0.22), 0 4px 14px rgba(0,0,0,0.14) !important; color: rgba(255,240,205,0.96) !important; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
  }, []);
  
  // History restore state
  const [restoreKey, setRestoreKey] = useState(0);
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
    // Persist current live search value before switching
    if (activePage === "rhyme") setLastRhymeSearch(liveRhymeWord.current);
    setActivePage(page);
    if (state) {
      setRestoreState(state);
    } else {
      // Clear word restore so stale search doesn't repopulate
      setRestoreState({});
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
    
    setRestoreKey(k => k + 1);
    navigateTo(page, {
      word: item.data.word,
      url: item.data.url,
      platform: item.data.platform,
    });
  }

  function openDictionary(word: string, fromSearchWord?: string) {
    setDictWord(word);
    const lower = word.toLowerCase();
    setLastClickedRhymeWord(lower);
    if (fromSearchWord) setLastRhymeSearch(fromSearchWord);
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
    { page: "key",        label: "Key Finder" },
    { page: "bpm",        label: "BPM Finder" },
    { page: "youtube",    label: "Downloader" },
    { page: "converter",  label: "File Converter" },
    { page: "master",     label: "Audio Master" },
  ];

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-black text-white">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-40 w-full flex flex-col items-center pt-6 pb-3"
        style={{
          backgroundColor: "rgba(0,0,0,0.92)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
      <div className="flex items-center justify-between w-full max-w-4xl px-4 mb-4">
        {/* Hamburger Menu Button + Dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="glass-btn p-2 rounded-xl text-white"
            style={{
              backgroundColor: "rgba(20,20,24,0.48)",
              backdropFilter: "blur(14px) saturate(160%)",
              WebkitBackdropFilter: "blur(14px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
            }}
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
            <div
              ref={dropdownRef}
              className="absolute left-0 top-full mt-2 rounded-3xl shadow-2xl z-50 overflow-hidden"
              onMouseLeave={() => setHoveredMenuItem(null)}
              style={{
                backgroundColor: "rgb(10,10,12)",
                border: "1px solid rgba(201,168,76,0.28)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(201,168,76,0.12)",
              }}
            >
              <div className="p-1.5 flex flex-col gap-0.5">
                {NAV_ITEMS.map(({ page, label }) => {
                  const isHovered = hoveredMenuItem === page;
                  const isActive = activePage === page;
                  return (
                    <button
                      key={page}
                      onClick={() => {
                        if (page === "rhyme" && activePage === "rhyme") {
                          window.location.reload();
                        } else {
                          navigateTo(page);
                        }
                      }}
                      onMouseEnter={() => setHoveredMenuItem(page)}
                      onTouchStart={() => setHoveredMenuItem(page)}
                      data-menu-page={page}
                      className="w-full text-left px-3 py-1.5 rounded-full outline-none whitespace-nowrap"
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        color: isActive ? "rgba(255,255,255,0.45)" : isHovered ? "rgba(255,240,205,0.96)" : "rgba(255,255,255,0.85)",
                        backgroundColor: isHovered && !isActive ? "rgba(201,168,76,0.1)" : "transparent",
                        border: isActive ? "1px solid rgba(201,168,76,0.6)" : isHovered ? "1px solid rgba(201,168,76,0.35)" : "1px solid transparent",
                        transition: "color 120ms ease-out, background-color 120ms ease-out, border-color 120ms ease-out",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
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

      {/* Nav row — matches logo row width exactly, spacers mirror hamburger+history buttons */}
      <div className="flex items-center w-full max-w-4xl px-4 gap-3">
        <div className="flex-shrink-0 w-9" />{/* spacer = hamburger button width */}
        <div className="flex-1 min-w-0">
          <DesktopNav
            items={NAV_ITEMS}
            activePage={activePage}
            onNavigate={(page) => {
              if (page === "rhyme" && activePage === "rhyme") window.location.reload();
              else navigateTo(page as Page);
            }}
          />
          <MobileNav
            items={NAV_ITEMS}
            activePage={activePage}
            onNavigate={(page: string) => {
              if (page === "rhyme" && activePage === "rhyme") window.location.reload();
              else navigateTo(page as Page);
            }}
          />
        </div>
        <div className="flex-shrink-0 w-9" />{/* spacer = history button width */}
      </div>
      </div>{/* end sticky header */}

      <div className="w-full flex flex-col items-center pt-6">

      {activePage === "rhyme"      && <RhymeFinder key={restoreKey} onLookupWord={(word) => openDictionary(word, restoreState.word || lastRhymeSearch)} highlightWord={lastClickedRhymeWord} initialWord={restoreState.word || lastRhymeSearch} onWordChange={(w) => { liveRhymeWord.current = w; }} />}
      {activePage === "key"        && <KeyFinder key={restoreKey}
        initialUrl={restoreState.url} 
        initialPlatform={restoreState.platform}
        initialKey={restoreState.key}
        initialScale={restoreState.scale}
        initialStrength={restoreState.strength}
        initialRelativeKey={restoreState.relativeKey}
        initialRelativeScale={restoreState.relativeScale}
      />}
      {activePage === "bpm"        && <BpmFinder key={restoreKey}
        initialUrl={restoreState.url} 
        initialPlatform={restoreState.platform}
        initialBpm={restoreState.bpm}
        initialTimeSignature={restoreState.timeSignature}
        initialBeatCount={restoreState.beatCount}
      />}
      {activePage === "master"     && <AudioMaster key={restoreKey} initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
      {activePage === "voice"      && <VoiceRemover key={restoreKey} initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
      {activePage === "youtube"    && <Downloader key={restoreKey} initialUrl={restoreState.url} initialPlatform={restoreState.platform} />}
      {activePage === "converter"  && <FileConverter />}
      {activePage === "dictionary" && (
        <Dictionary
          initialWord={dictWord}
          onWordChange={(w) => { liveDictWord.current = w; }}
          onBack={previousPage === "rhyme" ? () => {
            setLastClickedRhymeWord(dictWord.toLowerCase());
            setRestoreKey(k => k + 1);
            setRestoreState(s => ({ ...s, word: lastRhymeSearch || s.word }));
            navigateTo("rhyme");
          } : undefined}
        />
      )}
      {/* 728x90 leaderboard — desktop only */}
      <div className="hidden sm:flex justify-center w-full mt-8">
        <BannerAd zoneId="11324514" width={728} height={90} />
      </div>
      {/* 300x250 rectangle — mobile only */}
      <div className="flex sm:hidden justify-center w-full mt-8">
        <BannerAd zoneId="11324558" width={300} height={250} />
      </div>
      <ToastContainer />
      <RateLimitModal />
      </div>{/* end content wrapper */}
    </main>
  );
}
