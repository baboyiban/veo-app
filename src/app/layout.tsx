import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veo 3 Video Generator",
  description: "Generate 8s 720p videos with audio using Google's Veo 3 (preview)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
