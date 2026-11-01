import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "群戏 · 把群聊编译成一局桌游",
  description: "上传宿舍群聊天记录，30 秒生成一局只有你们能玩的桌游；淘汰到最后，带走一张群年鉴。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
