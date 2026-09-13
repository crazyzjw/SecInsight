import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEC Insight · 美股财报分析",
  description: "从 SEC 官方申报出发，洞察上市公司的财务表现。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
