import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_JP } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PROZEN – Profit × Kaizen",
  description: "AI-native Product Management OS for solopreneurs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${notoSansJP.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
