import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import Footer from "./components/Footer";
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
        <Script id="adcash-video-slider" strategy="afterInteractive">
          {`aclib.runVideoSlider({ zoneId: '11324510' });`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        {/* Left skyscraper 160x600 — desktop xl+ only */}
        <div id="ac-left" className="hidden xl:block" style={{ position: "fixed", top: "50%", transform: "translateY(-50%)", left: 0, width: 160, height: 600, zIndex: 10, overflow: "hidden" }} />
        {/* Right skyscraper 160x600 — desktop xl+ only */}
        <div id="ac-right" className="hidden xl:block" style={{ position: "fixed", top: "50%", transform: "translateY(-50%)", right: 0, width: 160, height: 600, zIndex: 10, overflow: "hidden" }} />
        <Script id="ac-side-init" strategy="afterInteractive">{`
          (function(){
            function init(){
              var l=document.getElementById('ac-left');
              var r=document.getElementById('ac-right');
              if(l){ var s=document.createElement('script'); s.type='text/javascript'; s.text="aclib.runBanner({zoneId:'11324470'});"; l.appendChild(s); }
              if(r){ var s2=document.createElement('script'); s2.type='text/javascript'; s2.text="aclib.runBanner({zoneId:'11324470'});"; r.appendChild(s2); }
            }
            if(window.aclib){ init(); } else { var t=setInterval(function(){ if(window.aclib){ clearInterval(t); init(); } },100); }
          })();
        `}</Script>
        {children}
        <Footer />
      </body>
    </html>
  );
}
