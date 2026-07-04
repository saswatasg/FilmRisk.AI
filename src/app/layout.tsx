import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { Clapperboard } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Greenlit",
  description: "Film investment intelligence platform for producers and financiers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Clapperboard className="size-4 text-emerald-400" />
              </span>
              <span className="font-serif-accent">Green</span>lit
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link
                href="/evaluate"
                className="text-white/50 transition-all duration-200 hover:text-emerald-400 hover:drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]"
              >
                Evaluate
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
