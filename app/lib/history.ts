// History tracking utilities using localStorage

export type HistoryItem = {
  id: string;
  type: "rhyme_search" | "dictionary_lookup" | "download" | "bpm_detect" | "key_detect" | "song_split";
  title: string;
  details?: string;
  timestamp: number;
};

const STORAGE_KEY = "sarcastic_music_history";
const MAX_ITEMS = 50;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function addHistoryItem(item: Omit<HistoryItem, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const history = getHistory();
    const newItem: HistoryItem = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
    };
    // Add to beginning, keep max items
    const updated = [newItem, ...history].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function deleteHistoryItem(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const history = getHistory();
    const updated = history.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function getHistoryIcon(type: HistoryItem["type"]): string {
  const icons: Record<HistoryItem["type"], string> = {
    rhyme_search: "📝",
    dictionary_lookup: "📖",
    download: "⬇️",
    bpm_detect: "🎵",
    key_detect: "🎹",
    song_split: "✂️",
  };
  return icons[type] || "📌";
}
