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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
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
        className="glass-btn relative p-2 rounded-xl"
        style={{
          color: isOpen ? "rgba(255,240,205,0.96)" : "rgba(255,255,255,1)",
          backgroundColor: "rgba(20,20,24,0.48)",
          backdropFilter: "blur(14px) saturate(160%)",
          WebkitBackdropFilter: "blur(14px) saturate(160%)",
          border: isOpen ? "1px solid rgba(201,168,76,0.6)" : "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.14)",
        }}
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
        <div
          className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-3xl shadow-2xl z-50 overflow-hidden"
          onMouseLeave={() => setHoveredItem(null)}
          onTouchEnd={() => setHoveredItem(null)}
          style={{
            backgroundColor: "rgba(20,20,24,0.72)",
            backdropFilter: "blur(18px) saturate(180%)",
            WebkitBackdropFilter: "blur(18px) saturate(180%)",
            border: "1px solid rgba(201,168,76,0.28)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(201,168,76,0.12)",
          }}
        >
          <div className="px-3 pt-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)", letterSpacing: "-0.01em" }}>History</h3>
              {history.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-xs transition-colors"
                  style={{ color: "rgba(255,100,100,0.7)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,100,100,1)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,100,100,0.7)")}
                >
                  Clear all
                </button>
              )}
            </div>
            {history.length > 0 && (
              <button
                onClick={exportToTxt}
                className="text-xs px-3 py-1 rounded-full transition-colors"
                style={{
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Export Text File
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5 flex flex-col gap-0.5">
            {history.length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                <p>No history yet</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Your searches and downloads will appear here</p>
              </div>
            ) : (
              history.map((item) => {
                const isHov = hoveredItem === item.id;
                return (
                  <div
                    key={item.id}
                    data-history-id={item.id}
                    onClick={() => { if (onSelect) { onSelect(item); setIsOpen(false); } }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onTouchStart={() => setHoveredItem(item.id)}
                    onTouchMove={(e) => {
                      const touch = e.touches[0];
                      const el = document.elementFromPoint(touch.clientX, touch.clientY);
                      const row = el?.closest('[data-history-id]') as HTMLElement | null;
                      if (row) setHoveredItem(row.dataset.historyId || null);
                    }}
                    className="flex items-start gap-3 px-3 py-2 rounded-full group"
                    style={{
                      cursor: onSelect ? "pointer" : "default",
                      backgroundColor: isHov ? "rgba(201,168,76,0.1)" : "transparent",
                      border: isHov ? "1px solid rgba(201,168,76,0.35)" : "1px solid transparent",
                      transition: "background-color 120ms ease-out, border-color 120ms ease-out",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate flex items-center gap-2" style={{ fontWeight: 500, color: isHov ? "rgba(255,240,205,0.96)" : "rgba(255,255,255,0.85)", transition: "color 120ms ease-out" }}>
                        {item.title}
                        {onSelect && item.data && (
                          <svg className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(201,168,76,0.8)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        )}
                      </p>
                      {item.details && (
                        <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{item.details}</p>
                      )}
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{formatTimestamp(item.timestamp)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,100,100,0.9)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
