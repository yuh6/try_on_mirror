import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "换装魔镜 MirrorMag",
  description: "上传全身照与衣服图，AI 一键生成试穿大片",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${notoSansSC.variable} h-full antialiased`}>
      <body className="min-h-full font-[family-name:var(--font-noto-sans-sc)]">
        {children}
      </body>
    </html>
  );
}
