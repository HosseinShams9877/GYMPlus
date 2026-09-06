import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { siteConfig } from "@/config/site";
import { AppProvider } from "@/providers/app-provider";

import "./globals.css";

const yekanBakh = localFont({
  src: [
    {
      path: "../../public/assets/fonts/Yekanbakh_Thin.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/Yekanbakh_Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/Yekanbakh_Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/Yekanbakh_SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/Yekanbakh_Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/assets/fonts/Yekanbakh_Black.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-yekan-bakh",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fa" suppressHydrationWarning>
      <body className={yekanBakh.variable}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
