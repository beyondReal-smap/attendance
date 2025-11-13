import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Head from "next/head";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "근태 관리 시스템",
  description: "모바일 웹 기반 근태 관리 시스템",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <Head>
        <link
          rel="preload"
          href="/fonts/Suite-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Suite-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </Head>
      <body
        className={`${inter.variable} antialiased`}
        style={{
          fontFamily: 'SUITE, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overscrollBehavior: 'none'
        }}
      >
        {children}
      </body>
    </html>
  );
}
