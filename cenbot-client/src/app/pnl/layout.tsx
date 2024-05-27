import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";

const inter = IBM_Plex_Mono({
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  style: ["italic", "normal"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Show Pnl",
  description: "Cenbot | First Native Telegram Bot on SUI",
};

export default function PnLLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className={inter.className}>{children}</main>;
}
