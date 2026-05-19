import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AutoLogout } from "@/components/auto-logout";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
  display: "swap",
});

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
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('theme');
              if (saved === 'light') {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              } else if (saved === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
              } else {
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              }
            } catch (e) {}
          })();
        ` }} />
      </head>
      <body
        className={`${jakarta.variable} ${jetbrains.variable} bg-background text-foreground antialiased`}
        style={{ fontFamily: "var(--font-body)" }}
        suppressHydrationWarning
      >
        <AutoLogout />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}