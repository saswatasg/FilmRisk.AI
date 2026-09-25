import type { Metadata } from "next";
import Link from 'next/link'
import { Inter } from 'next/font/google'
import "./globals.css";
import { AuthNav } from "@/components/auth-nav";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Greenlit — Film Investment Intelligence",
  description: "Pre-release Bollywood film investment scoring, validated out-of-sample.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-50 h-16 border-b border-[#303030] bg-[#181818]/95 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Greenlit home">
              <span className="inline-block size-2.5 bg-[#da291c]" aria-hidden />
              <span className="text-[13px] font-semibold uppercase tracking-[0.65px] text-white">
                Greenlit
              </span>
            </Link>
            <AuthNav />
          </div>
        </header>
        <main id="main-content" className="flex-1">{children}</main>
      </body>
    </html>
  );
}
