import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ActiveViewerProvider } from "@/lib/membership/active-viewer";
import { LibraryProvider } from "@/lib/library";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { NotificationSoundProvider } from "@/components/NotificationSoundProvider";
import { ReminderBanner } from "@/components/ReminderBanner";
import { ManagedSystemLinks } from "@/components/ManagedSystemLinks";
import { RemoteNavigation } from "@/components/RemoteNavigation";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://gls-tv.vercel.app",
  ),
  title: {
    default: "GLS TV — Watch Live, Series & Movies",
    template: "%s · GLS TV",
  },
  description:
    "GLS TV — cinematic live TV, public series and movies. Professional 4K-ready streaming experience.",
  applicationName: "GLS TV",
  openGraph: {
    title: "GLS TV",
    description: "Cinematic live TV, series and movies.",
    type: "website",
    url: "/",
    siteName: "GLS TV",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GLS TV",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${outfit.variable} ${bebas.variable} h-full antialiased`}
    >
      <body className="gls-atmosphere min-h-full flex flex-col font-sans">
        <AuthProvider>
          <NotificationSoundProvider>
          <ActiveViewerProvider>
            <LibraryProvider>
              <ServiceWorkerRegister />
              <RemoteNavigation />
              <ReminderBanner />
              {children}
              <footer className="mt-auto border-t border-white/10 px-4 py-8">
                <ManagedSystemLinks placement="footer" />
              </footer>
              <SupportChatWidget />
            </LibraryProvider>
          </ActiveViewerProvider>
          </NotificationSoundProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
