import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy – Sarcastic Music",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12 max-w-3xl mx-auto">
      <Link href="/" className="text-[#C9A84C] text-sm hover:underline mb-8 inline-block">← Back</Link>
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-gray-500 text-xs mb-8">Last updated: May 2025</p>

      <section className="space-y-8 text-sm text-gray-300 leading-relaxed">

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">1. What We Collect</h2>
          <p>Sarcastic Music collects minimal data. Specifically:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong className="text-white">Disclaimer acceptance logs:</strong> When you confirm ownership rights in the Downloader, we store a hashed session ID, timestamp, and tool name — no personal identifiers.</li>
            <li><strong className="text-white">Standard server logs:</strong> Basic request logs (IP address, browser type) may be retained temporarily by our hosting provider for security and performance.</li>
            <li><strong className="text-white">No account data:</strong> We do not require accounts, emails, or any registration.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">2. What We Do NOT Collect or Store</h2>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Audio files you upload or download — these are deleted immediately after processing.</li>
            <li>URLs you paste into the downloader — not logged or retained.</li>
            <li>Your name, email, or any personal identifiers.</li>
            <li>Payment information of any kind.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">3. Cookies & Tracking</h2>
          <p>We may use anonymous analytics (e.g. page views) to understand how the tools are used. We do not use tracking cookies for advertising purposes beyond what Google AdSense may set. See <a href="https://policies.google.com/privacy" className="text-[#C9A84C] hover:underline" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a> for AdSense data practices.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">4. File Processing</h2>
          <p>All files processed by our tools (Song Splitter, Key Finder, BPM Finder, Audio Master, Downloader) are handled server-side in temporary storage and permanently deleted within seconds of the response being sent to you. We have no ability to access or recover your files after this point.</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">5. Third-Party Services</h2>
          <p>We use the following third-party services that may independently collect data:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong className="text-white">Google AdSense</strong> — for display advertising</li>
            <li><strong className="text-white">Hosting provider</strong> — standard server infrastructure logs</li>
          </ul>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">6. Your Rights</h2>
          <p>Since we do not collect personal data, there is typically nothing to delete or export. If you have concerns, contact us at:</p>
          <p className="mt-2 text-[#C9A84C]">legal@sarcasticmusic.com</p>
        </div>

        <div>
          <h2 className="text-[#C9A84C] font-semibold text-base mb-2">7. Changes to This Policy</h2>
          <p>We may update this policy periodically. Continued use of the Service after changes means you accept the updated policy.</p>
        </div>

      </section>
    </main>
  );
}
