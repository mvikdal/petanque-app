import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
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
  title: "Petanque Seriespill",
  description: "Sesongtabell og resultater for petanque-seriespill",
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-100 text-neutral-900">
        <header className="bg-indigo-950">
          <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 font-semibold text-white text-lg">
              <Image
                src="/sinsen-logo.png"
                alt="Sinsen Petanque"
                width={36}
                height={36}
                loading="eager"
              />
              Petanque Seriespill
            </Link>
            <Link
              href="/admin"
              prefetch={false}
              className="text-sm font-medium text-indigo-200 hover:text-white"
            >
              Admin
            </Link>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
