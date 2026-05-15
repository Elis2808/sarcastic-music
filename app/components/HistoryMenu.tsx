"use client";

import { useState, useEffect, useRef } from "react";
import { getHistory, clearHistory, deleteHistoryItem, formatTimestamp, getHistoryIcon, type HistoryItem } from "../lib/history";

export default function HistoryMenu() {
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

  return (
    <div ref={menuRef} className="relative">
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 hover:border-[#C9A84C]"
        aria-label="History"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {hasNew && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#C9A84C] rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] bg-gray-900 rounded-xl border border-gray-700 shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
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
                    className="p-3 hover:bg-gray-800/50 transition-colors flex items-start gap-3 group"
                  >
                    <span className="text-lg flex-shrink-0">{getHistoryIcon(item.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.title}</p>
                      {item.details && (
                        <p className="text-xs text-gray-500 truncate">{item.details}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-0.5">{formatTimestamp(item.timestamp)}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
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
