import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "伏特家 VOLT+",
  description: "智能实时电力交易、V 币钱包与 Token 购买工作台",
  icons: {
    icon: "/brand/volt-logo.svg",
    apple: "/brand/volt-logo.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f8f5"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
