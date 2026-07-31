import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { LanguageProvider } from "@/lib/i18n";

// One Latin family, used from 400 to 900. The heavy weights carry the sign
// lettering; Chinese falls through to the platform's own HK face.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yau Lok! 有落",
  description:
    "Situated Cantonese copilot for Hong Kong — never miss your minibus stop again.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Yau Lok!",
    statusBarStyle: "default",
  },
};

export const viewport = {
  themeColor: "#d7263d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // never trap a user who needs to zoom
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
