"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-black border-t mt-16" style={{ borderColor: "rgba(201,168,76,0.2)" }}>
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-gray-600 text-xs">© {new Date().getFullYear()} Sarcastic Music. For personal use only.</p>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/terms" className="text-gray-500 hover:text-[#C9A84C] transition-colors">Terms of Service</Link>
          <span className="text-gray-700">·</span>
          <Link href="/privacy" className="text-gray-500 hover:text-[#C9A84C] transition-colors">Privacy Policy</Link>
          <span className="text-gray-700">·</span>
          <a href="mailto:sarcasticmusic2120@gmail.com?subject=Legal" className="text-gray-500 hover:text-[#C9A84C] transition-colors">DMCA / Legal</a>
        </div>
      </div>
    </footer>
  );
}
