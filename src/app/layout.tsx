import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FilmRisk Bollywood",
  description: "Film investment intelligence platform for Bollywood producers and financiers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b">
          <div className="mx-auto flex h-12 max-w-5xl items-center gap-6 px-4">
            <a href="/" className="font-semibold tracking-tight">FilmRisk</a>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <a href="/evaluate" className="hover:text-foreground transition-colors">Evaluate</a>
              <a href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
