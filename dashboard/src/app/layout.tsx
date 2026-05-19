import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AutoLogout } from "@/components/auto-logout";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Smart Kitchen Hygiene Monitor",
  description: "AIoT Dashboard for Kitchen Hygiene Monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-zinc-950 text-zinc-50 antialiased`} suppressHydrationWarning>
        <AutoLogout />
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
