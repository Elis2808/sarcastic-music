"use client";

import { useState, useEffect, useRef } from "react";
import { getHistory, clearHistory, deleteHistoryItem, formatTimestamp, type HistoryItem } from "../lib/history";
import { showToast } from "./Toast";

interface HistoryMenuProps {
  onSelect?: (item: HistoryItem) => void;
}

export default function HistoryMenu({ onSelect }: HistoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  // Load history when menu opens
  useEffect(() => {
    if (isOpen) {
      const items = getHistory();
      setHistory(items);
      setHasNew(false);
    }
  }, [isOpen]);

  // Check for new items periodically when closed
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (!isOpen) {
        const items = getHistory();
        if (items.length > lastCountRef.current) {
          setHasNew(true);
        }
        lastCountRef.current = items.length;
      }
    }, 2000);
    return () => clearInterval(checkInterval);
  }, [isOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function handleClear() {
    clearHistory();
    setHistory([]);
  }

  function handleDelete(id: string) {
    deleteHistoryItem(id);
    setHistory(getHistory());
  }

  function exportToTxt() {
    const data = getHistory();
    const lines = data.map((item) => {
      const date = new Date(item.timestamp).toLocaleString();
      let line = `[${date}] ${item.title}`;
      if (item.details) line += ` — ${item.details}`;
      return line;
    });
    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sarcastic-music-history-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("History exported", "success");
    setIsOpen(false);
  }

  return (
    <div ref={menuRef} className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-black border-2 border-[#C9A84C]/50 hover:border-[#C9A84C] text-[#C9A84C] transition-all duration-200"
        aria-label="History"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#C9A84C] rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-black rounded-xl border border-[#C9A84C]/40 shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">History</h3>
              {history.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
            {history.length > 0 && (
              <button
                onClick={exportToTxt}
                className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              >
                Export .txt
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {history.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <p>No history yet</p>
                <p className="text-xs mt-1 text-gray-600">
                  Your searches and downloads will appear here
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (onSelect) {
                        onSelect(item);
                        setIsOpen(false);
                      }
                    }}
                    className={`p-3 hover:bg-gray-800/50 transition-colors flex items-start gap-3 group ${onSelect ? 'cursor-pointer' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate flex items-center gap-2">
                        {item.title}
                        {onSelect && item.data && (
                          <svg className="w-3 h-3 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </p>
                      {item.details && (
                        <p className="text-xs text-gray-500 truncate">{item.details}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">{formatTimestamp(item.timestamp)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
