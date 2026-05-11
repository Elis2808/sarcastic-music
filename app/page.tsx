"use client";

import { useState } from "react";
import KeyFinder from "./components/KeyFinder";
import BpmFinder from "./components/BpmFinder";
import VoiceRemover from "./components/VoiceRemover";
import FileConverter from "./components/FileConverter";
import Downloader from "./components/Downloader";
import RhymeFinder from "./components/RhymeFinder";
import Dictionary from "./components/Dictionary";

type Page = "rhyme" | "key" | "bpm" | "voice" | "youtube" | "dictionary" | "converter";

export default function Home() {
  const [activePage, setActivePage] = useState<Page>("rhyme");
  const [previousPage, setPreviousPage] = useState<Page | null>(null);
  const [dictWord, setDictWord] = useState("");

  function navigateTo(page: Page) {
    setPreviousPage(activePage);
    setActivePage(page);
  }

  function openDictionary(word: string) {
    setDictWord(word);
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
      <img src="/logo.png" alt="Sarcastic Music" className="mb-8 h-10 object-contain" />

      <nav className="flex gap-2 mb-6 max-sm:flex-wrap max-sm:justify-center">
        {NAV_ITEMS.map(({ page, label }) => (
          <button
            key={page}
            onClick={() => navigateTo(page)}
            className={`px-4 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#C9A84C] transition-colors ${
              activePage === page
                ? "bg-black text-white border border-[#C9A84C]"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {activePage === "rhyme"      && <RhymeFinder onLookupWord={openDictionary} />}
      {activePage === "key"        && <KeyFinder />}
      {activePage === "bpm"        && <BpmFinder />}
      {activePage === "voice"      && <VoiceRemover />}
      {activePage === "youtube"    && <Downloader />}
      {activePage === "converter"  && <FileConverter />}
      {activePage === "dictionary" && (
        <Dictionary
          initialWord={dictWord}
          onBack={previousPage === "rhyme" ? () => navigateTo("rhyme") : undefined}
        />
      )}
    </main>
  );
}
