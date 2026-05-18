import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service – Sarcastic Music",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12 max-w-3xl mx-auto">
      <Link href="/" className="text-[#C9A84C] text-sm hover:underline mb-8 inline-block">← Back</Link>
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="text-gray-500 text-xs mb-8">Last updated: May 2026</p>

      <section className="space-y-8 text-sm text-gray-300 leading-relaxed">

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">1. Acceptance of Terms</h2>
          <p>By accessing or using Sarcastic Music, you agree to be bound by these Terms of Service. If you do not agree, do not use our service.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">2. Use of the Downloader Tool</h2>
          <p>The downloader tool is provided for <strong className="text-white">personal, non-commercial use only</strong>. By using the downloader, you confirm that:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>You own or have the legal right to download the content.</li>
            <li>You will not use downloaded content for commercial purposes or public distribution.</li>
            <li>You understand that downloading certain content without authorization may violate applicable laws and platform terms of service.</li>
          </ul>
          <p className="mt-2">Sarcastic Music does not endorse or encourage the downloading of copyrighted content and bears no liability for misuse.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">3. File Processing & Storage</h2>
          <p>All audio files uploaded or processed through our service (including the Song Splitter, Key Finder, BPM Finder, and Audio Master) are:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Processed in temporary server memory only.</li>
            <li>Automatically deleted immediately after processing is complete.</li>
            <li>Never stored, sold, shared, or retained by Sarcastic Music.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">4. Disclaimer Acceptance Logging</h2>
          <p>When you check the rights confirmation checkbox on the Downloader, we log a minimal record for compliance purposes containing:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>A hashed/anonymized session identifier (not linked to personal data)</li>
            <li>Timestamp of acceptance</li>
            <li>Tool used</li>
          </ul>
          <p className="mt-2">This log demonstrates that users explicitly agreed to the terms before processing. No personal data, names, emails, or content URLs are stored in this server-side log. Note: the History feature stores URLs and search queries locally in your browser (localStorage only) — this data never leaves your device.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">5. Intellectual Property</h2>
          <p>You retain all rights to content you upload. Sarcastic Music claims no ownership over any audio files you process through our service.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">6. Limitation of Liability</h2>
          <p>Sarcastic Music provides all tools as-is without warranties of any kind. We are not liable for any damages arising from your use of our service, including any legal consequences resulting from your downloading or use of third-party content.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">7. DMCA & Copyright</h2>
          <p>We respect intellectual property rights. If you believe content accessed through our tools infringes your copyright, please contact us at:</p>
          <a href="mailto:sarcasticmusic2120@gmail.com?subject=Legal" className="mt-2 text-[#C9A84C] hover:underline block">sarcasticmusic2120@gmail.com</a>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">8. Changes to Terms</h2>
          <p>We may update these Terms at any time. Continued use of our service after changes constitutes acceptance of the new Terms.</p>
        </div>

      </section>
    </main>
  );
}
