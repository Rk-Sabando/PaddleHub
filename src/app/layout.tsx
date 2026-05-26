import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
import { ServiceWorkerRegistrar } from "@/components/push/ServiceWorkerRegistrar";
import { Toaster } from "@/components/ui/toaster";
// @ts-expect-error: CSS module import for global styles
import "./globals.css";

export const metadata: Metadata = {
  title: "PaddleHub — Find your next pickleball match",
  description: "Match-make pickleball games by skill, schedule, and format.",
  manifest: "/manifest.webmanifest",
  applicationName: "PaddleHub",
  appleWebApp: {
    capable: true,
    title: "PaddleHub",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased">
          <Providers>
            <ServiceWorkerRegistrar />
            {children}
            <Toaster />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
