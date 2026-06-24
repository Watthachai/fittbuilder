import type { Metadata } from "next";
import { Anuphan, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import FloatingThemeToggle from "@/components/FloatingThemeToggle";

// Inter is the theme's typeface (docs/brief-plans/design.md); it has no Thai
// glyphs, so Anuphan sits behind it in the stack for Thai text.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const anuphan = Anuphan({
  variable: "--font-anuphan",
  subsets: ["latin", "thai"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        {children}
        <FloatingThemeToggle />
      </body>
    </html>
  );
}
