import type { Metadata } from "next";
import { Inter, Playfair_Display, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "小棉袄 — 给独居老人的AI陪伴",
  description:
    "小棉袄主动给独居老人打电话——聊天、提醒吃药、留意心情、紧急时联系家人。子女随时看到老人今天过得好不好。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${playfairDisplay.variable} ${notoSansSC.variable} h-full antialiased`}
    >
      <body className="min-h-full font-[family-name:var(--font-inter),var(--font-noto-sans-sc),ui-sans-serif,system-ui,sans-serif]">
        {children}
      </body>
    </html>
  );
}
