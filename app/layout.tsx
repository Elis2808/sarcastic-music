import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import Footer from "./components/Footer";
import SideAd from "./components/SideAd";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "600", "800"],
});

export const metadata: Metadata = {
  title: "Sarcastic Music",
  description: "A music tool made by artists for artists",
  icons: {
    icon: [
      { url: "/favicon-new.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/favicon-new.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="google-adsense-account" content="ca-pub-2153521717921171" />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2153521717921171"
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <Script id="aclib" src="//acscdn.com/script/aclib.js" strategy="afterInteractive" />
      </head>
      <body className="min-h-full flex flex-col">
        <SideAd side="left" />
        <SideAd side="right" />
        {children}
        <Footer />
      </body>
    </html>
  );
}
