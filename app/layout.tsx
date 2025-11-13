import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const suite = localFont({
  src: [
    {
      path: '../public/fonts/SUITE-Variable.woff2',
      weight: '100 900',
      style: 'normal',
    }
  ],
  variable: '--font-suite',
  display: 'swap',
  preload: true,
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
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
    <html lang="ko" className={suite.variable}>
      <body
        className={`${suite.className} antialiased`}
        style={{
          overscrollBehavior: 'none'
        }}
      >
        {children}
      </body>
    </html>
  );
}
