import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
// @ts-ignore: CSS module import for global styles
import "./globals.css";

export const metadata: Metadata = {
  title: "PaddleHub — Find your next pickleball match",
  description: "Match-make pickleball games by skill, schedule, and format.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
