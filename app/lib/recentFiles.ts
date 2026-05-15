// Recent files storage using localStorage

const STORAGE_KEY = "sarcastic_recent_files";
const MAX_RECENT_FILES = 10;

export interface RecentFile {
  id: string;
  name: string;
  type: string;
  size: number;
  timestamp: number;
  tool: string;
}

export function getRecentFiles(): RecentFile[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentFile(file: Omit<RecentFile, "id" | "timestamp">): void {
  if (typeof window === "undefined") return;
  try {
    const files = getRecentFiles();
    const newFile: RecentFile = {
      ...file,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    // Remove duplicates by name+tool
    const filtered = files.filter((f) => !(f.name === file.name && f.tool === file.tool));
    const updated = [newFile, ...filtered].slice(0, MAX_RECENT_FILES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function deleteRecentFile(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const files = getRecentFiles().filter((f) => f.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  } catch {
    // Ignore storage errors
  }
}

export function clearRecentFiles(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
