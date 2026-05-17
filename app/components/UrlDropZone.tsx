"use client";

import { useState, useCallback } from "react";

interface UrlDropZoneProps {
  onUrlDrop: (url: string) => void;
  children: React.ReactNode;
  className?: string;
}

export default function UrlDropZone({ onUrlDrop, children, className = "" }: UrlDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if dragging contains URL data
    const hasUrl = e.dataTransfer.types.includes("text/uri-list") || 
                   e.dataTransfer.types.includes("text/plain");
    if (hasUrl) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Try to get URL from drop
    const url = e.dataTransfer.getData("text/uri-list") || 
                e.dataTransfer.getData("text/plain");
    
    if (url && isValidUrl(url)) {
      onUrlDrop(url);
    }
  }, [onUrlDrop]);

  function isValidUrl(string: string): boolean {
    try {
      new URL(string);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div 
      className={`relative ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragging && (
        <div className="absolute inset-0 bg-black border-2 border-[#C9A84C] rounded-xl flex items-center justify-center z-50">
          <div className="text-center">
            <svg className="w-12 h-12 text-[#C9A84C] mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-[#C9A84C] font-medium">Drop URL here</p>
          </div>
        </div>
      )}
    </div>
  );
}
