import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "PFitness",
  title: { default: "PFitness", template: "%s · PFitness" },
  description: "Treino, alimentação e gamificação.",
  appleWebApp: {
    capable: true,
    title: "PFitness",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  // O Next só emite `mobile-web-app-capable`; iOS anteriores ao 16.4 leem a versão Apple
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05070a",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${chakraPetch.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <body>
        {/* public/sw.js é gerado no build (scripts/build-sw.mjs); em dev fica desligado */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV === "development"}>
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
