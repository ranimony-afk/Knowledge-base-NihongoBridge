import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-jp";
import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/ui/Providers";

export const metadata: Metadata = {
  title: "NihongoBridge Admin",
  description: "Content, tests, media, pipelines, and publishing administration.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
