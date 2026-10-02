import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "플랜두씨 다이어리",
  description: "계획과 실제 기록을 연결하는 공개 학습 다이어리",
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
