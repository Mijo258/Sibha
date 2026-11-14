import type { Metadata } from "next";
import { Geist, Geist_Mono, Amiri, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { GeometricBackground } from "@/components/geometric-background";
import { NavigationMenu } from "@/components/NavigationMenu";
import {
  PageTransitionContent,
  PageTransitionProvider,
} from "@/components/page-transitions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeScript } from "@/components/theme-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Amiri is the standard naskh face for Qur'anic typesetting.
const amiri = Amiri({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Maha — Tasbeeh & Qur'an",
  description:
    "A digital tasbeeh counter and Qur'an reader with recitation by Mishary Alafasy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${amiri.variable} ${cormorant.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-full flex flex-col">
        <PageTransitionProvider>
          <GeometricBackground />
          <SiteHeader />
          <NavigationMenu />
          <PageTransitionContent>{children}</PageTransitionContent>
          <SiteFooter />
        </PageTransitionProvider>
      </body>
    </html>
  );
}
