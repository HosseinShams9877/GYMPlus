export const siteConfig = {
  name: "GymPlus",
  description:
    "A modern fitness platform foundation built with Next.js for scalable product development.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  navigation: [
    { label: "Features", href: "#features" },
    { label: "Architecture", href: "#architecture" },
    { label: "Start", href: "#start" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
