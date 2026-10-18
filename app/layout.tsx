import type { Metadata, Viewport } from "next";
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
  title: "Petanque Seriespill",
  description: "Sesongtabell og resultater for petanque-seriespill",
};

export const viewport: Viewport = {
  colorScheme: "light",
};

// Topplinje og <main> ligger i underliggende layouts: klubbsidene har
// klubbens navn og admin-lenke, forsiden og superadmin har sin egen.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-100 text-neutral-900">
        {children}
      </body>
    </html>
  );
}
