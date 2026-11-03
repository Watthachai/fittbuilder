import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import FloatingThemeToggle from "@/components/FloatingThemeToggle";
import GlobalGenerationIndicator from "@/components/GlobalGenerationIndicator";
import VersionWatcher from "@/components/VersionWatcher";
import Toaster from "@/components/ui/Toaster";
import ConfirmHost from "@/components/ui/ConfirmHost";
import CreateWorkspaceHost from "@/components/org/CreateWorkspaceHost";
import { CaseInboxProvider } from "@/components/cases/CaseInbox";

// Inter is the theme's typeface (docs/brief-plans/design.md); it has no Thai
// glyphs, so Anuphan sits behind it in the stack for Thai text — and only its
// Thai file is kept, since every Latin glyph is Inter's.
//
// The Google Fonts files (OFL) live in the repo rather than coming through
// next/font/google: a production build that could not fetch one failed with
// "next/font/google queries have exactly one entry" (2026-10-30, 2026-11-03),
// while the same commit built on sandbox.
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "100 900",
  variable: "--font-inter",
});

const anuphan = localFont({
  src: "./fonts/anuphan-thai.woff2",
  weight: "100 700",
  variable: "--font-anuphan",
});

const plexMono = localFont({
  src: [
    { path: "./fonts/plex-mono-400-latin.woff2", weight: "400" },
    { path: "./fonts/plex-mono-500-latin.woff2", weight: "500" },
    { path: "./fonts/plex-mono-600-latin.woff2", weight: "600" },
  ],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "FITT Builder — พิมพ์ Prompt แล้วได้เว็บจริงใน 60 วินาที",
    template: "%s · FITT Builder",
  },
  description:
    "AI web demo builder สำหรับ designer, PM และทุกคนที่ไม่เขียนโค้ด — พิมพ์ prompt ภาษาไทยหรืออังกฤษ แล้วได้ web demo ที่รันจริงใน browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${inter.variable} ${anuphan.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* No-FOUC theme: apply the saved theme (or OS default) before paint.
            'system'/absent → no class (CSS @media decides); 'light'/'dark' → class. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fitt-theme');var c=document.documentElement.classList;c.remove('light','dark');if(t==='light'||t==='dark')c.add(t);}catch(e){}})();`,
          }}
        />
        {/* No-FOUC text size (lib/useFontScale.ts): the saved percent on the root, before paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=Number(localStorage.getItem('fitt-font-scale'));if(s>=90&&s<=140&&s%10===0&&s!==100)document.documentElement.style.fontSize=s+'%';}catch(e){}})();`,
          }}
        />
        {/* Helvetica Now Display — used by the Mainframe-style landing hero. */}
        <link
          rel="stylesheet"
          href="https://db.onlinewebfonts.com/c/5ac3fe7c6abd2f62067f266d89671492?family=HelveticaNowDisplay-Medium"
        />
        <link
          rel="stylesheet"
          href="https://db.onlinewebfonts.com/c/1aa3377e489837a26d019bba501e779d?family=HelveticaNowDisplayW01-Rg"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <CaseInboxProvider>{children}</CaseInboxProvider>
        <FloatingThemeToggle />
        <GlobalGenerationIndicator />
        <VersionWatcher />
        <Toaster />
        <ConfirmHost />
        <CreateWorkspaceHost />
      </body>
    </html>
  );
}
