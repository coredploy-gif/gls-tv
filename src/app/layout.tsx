import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { ActiveViewerProvider } from "@/lib/membership/active-viewer";
import { LibraryProvider } from "@/lib/library";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { ReminderBanner } from "@/components/ReminderBanner";
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
  title: {
    default: "GLS TV — Watch Live, Series & Movies",
    template: "%s · GLS TV",
  },
  description:
    "GLS TV — cinematic live TV, public series and movies. Professional 4K-ready streaming experience.",
  applicationName: "GLS TV",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "GLS TV",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
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
          <ActiveViewerProvider>
            <LibraryProvider>
              <ServiceWorkerRegister />
              <ReminderBanner />
              {children}
              <SupportChatWidget />
            </LibraryProvider>
          </ActiveViewerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
