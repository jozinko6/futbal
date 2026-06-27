import type { Metadata } from "next";
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
  title: "Kačanovská FIFA — arkádový futbal",
  description: "Originálna arkádová futbalová hra inšpirovaná rýchlymi 16-bitovými futbalmi. 5 vs 5, pixel-art, deterministická simulácia, online multiplayer.",
  keywords: ["Kačanovská FIFA", "futbal", "arkáda", "pixel-art", "multiplayer", "Next.js", "TypeScript"],
  authors: [{ name: "Kačanovská FIFA" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Kačanovská FIFA",
    description: "Originálna arkádová futbalová hra s online multiplayerom",
    url: "https://chat.z.ai",
    siteName: "Kačanovská FIFA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kačanovská FIFA",
    description: "Originálna arkádová futbalová hra s online multiplayerom",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
